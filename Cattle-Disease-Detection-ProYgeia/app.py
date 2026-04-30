from flask import Flask, request, jsonify, render_template
import numpy as np
import tensorflow as tf
import cv2
from tensorflow.keras.models import load_model, Model
from tensorflow.keras.preprocessing import image
import os

# Setup directories
TEMPLATE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

# Load the saved DenseNet121 model
MODEL_PATH = 'densenet121_cattle_disease.h5'
model = load_model(MODEL_PATH)

# Classes
class_labels = {0: 'Foot-and-Mouth', 1: 'Healthy', 2: 'Lumpy'}

def get_gradcam_heatmap(img_array, model, last_conv_layer_name="relu"):
    # Create a model that outputs the last conv layer and the final predictions
    grad_model = Model(
        inputs=model.inputs,
        outputs=[model.get_layer(last_conv_layer_name).output, model.output]
    )
    
    # Use GradientTape to monitor the gradients
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        
        # Handle cases where preds might be a list
        if isinstance(preds, list):
            preds = preds[0]
            
        pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]
        
    # Get the gradients of the predicted class with respect to the output of the conv layer
    grads = tape.gradient(class_channel, last_conv_layer_output)
    
    # Global average pooling of the gradients
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    
    # Multiply the feature map by the importance weights
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    
    # Normalize the heatmap
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-10)
    return heatmap.numpy()

def save_heatmap_overlay(original_img_path, heatmap, output_path, alpha=0.4):
    # Read the image and resize heatmap
    img = cv2.imread(original_img_path)
    heatmap = cv2.resize(heatmap, (img.shape[1], img.shape[0]))
    
    # Apply JET colormap
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    
    # Superimpose original image and heatmap
    superimposed_img = heatmap * alpha + img
    cv2.imwrite(output_path, superimposed_img)
    return output_path

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'})
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'})

    if file:
        os.makedirs('uploads', exist_ok=True)
        file_path = os.path.join('uploads', file.filename)
        file.save(file_path)

        # Preprocess input image
        img = image.load_img(file_path, target_size=(224, 224))
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) / 255.0

        # Run Prediction
        predictions = model.predict(img_array)[0]
        max_confidence = float(np.max(predictions))
        predicted_index = int(np.argmax(predictions))

        confidence_threshold = 0.85
        heatmap_url = None

        if max_confidence < confidence_threshold:
            result = "Unrecognized entity. Please upload a clear cattle skin image."
            status = "rejected"
        else:
            result = class_labels[predicted_index]
            status = "success"

            # Generate heatmap for diseases
            if result in ['Foot-and-Mouth', 'Lumpy']:
                try:
                    heatmap = get_gradcam_heatmap(img_array, model, last_conv_layer_name="relu")
                    heatmap_filename = f"heatmap_{file.filename}"
                    heatmap_path = os.path.join(STATIC_DIR, heatmap_filename)
                    
                    save_heatmap_overlay(file_path, heatmap, heatmap_path)
                    heatmap_url = f"/static/{heatmap_filename}"
                except Exception as e:
                    print(f"Heatmap error: {e}")

        # Cleanup: remove original uploaded file
        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({
            'status': status,
            'prediction': result,
            'confidence': f"{max_confidence*100:.2f}%",
            'heatmap_url': heatmap_url
        })

if __name__ == '__main__':
    # Running on port 5001 as requested
    app.run(debug=True, port=5001)