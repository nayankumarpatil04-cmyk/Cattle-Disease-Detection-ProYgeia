document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').classList.remove('hidden');
            document.getElementById('dropZone').classList.add('hidden');
        }
        reader.readAsDataURL(file);
    }
});

const treatments = {
    "Lumpy": `
        <h3>⚠️LSD COMMON VETERINARY TREATMENT (Supportive)</h3>
        <p class="warning">Use only under a veterinarian’s dose guidance. The exact dose depends on weight, age, milk status, and pregnancy.</p>
        
        <h4>A. For Fever and Pain</h4>
        <p>A vet usually selects ONE anti-inflammatory medicine: <em>Meloxicam injection, Flunixin meglumine, or Ketoprofen.</em></p>
        <ul><li>Reduces fever & pain</li><li>Improves appetite</li></ul>

        <h4>B. If Skin Sores are Infected</h4>
        <p>A vet may prescribe <em>Oxytetracycline</em> or another long-acting antibiotic.<br>
        <span class="warning" style="font-size:0.9rem;">⚠️ Antibiotics do not kill the LSD virus. They are used only if wounds become infected.</span></p>

        <h4>C. For Dehydration / Weakness</h4>
        <ul><li>Oral electrolytes</li><li>IV fluids if the cow is down or not drinking</li></ul>

        <h4>D. Simple Practical Village Treatment Plan</h4>
        <ul>
            <li><strong>Morning:</strong> Water, Soft green feed, Clean wounds, Keep flies away.</li>
            <li><strong>Evening:</strong> Recheck fever, Clean discharge/wounds, Continue soft feed + water.</li>
        </ul>

        <h4>🚨Call vet urgently if:</h4>
        <ul>
            <li>Cow not standing or drinking</li>
            <li>High fever > 104°F (40°C) or Udder badly swollen</li>
            <li>Skin wounds smell bad or Maggots present</li>
        </ul>
    `,
    "Foot-and-Mouth": `
        <h3>⚠️FMD COMMON SUPPORTIVE TREATMENT</h3>
        <p class="warning">There is no specific antiviral treatment for FMD; care is mainly supportive.</p>
        
        <h4>A. For Mouth Sores</h4>
        <p>Because mouth pain stops the cow from eating:</p>
        <ul>
            <li><span class="highlight">Give soft feed only:</span> green fodder, soft mash, soaked bran.</li>
            <li><span class="warning" style="background:none; color:red; padding:0;">Avoid:</span> dry straw, sharp feed, hard feed.</li>
            <li><strong>Mouth cleaning:</strong> Gently rinse with clean saline or mild vet-approved antiseptic rinse.</li>
        </ul>

        <h4>B. For Foot Sores / Lameness</h4>
        <ul>
            <li>Keep on soft, dry bedding and avoid walking.</li>
            <li>Wash feet gently with clean water or saline.</li>
        </ul>

        <h4>C. For Fever and Pain</h4>
        <p>A vet usually selects ONE anti-inflammatory: <em>Meloxicam, Flunixin, or Ketoprofen.</em><br>
        These help reduce mouth pain, reduce lameness, and improve feeding.</p>

        <h4>D. Simple Practical Village Treatment Plan</h4>
        <ul>
            <li><strong>Morning:</strong> Isolate animal, Mouth rinse, Foot cleaning, Soft feed.</li>
            <li><strong>Evening:</strong> Repeat mouth rinse, Keep feet clean/dry.</li>
        </ul>

        <h4>🚨Call vet urgently if:</h4>
        <ul>
            <li>Cow stops eating completely or cannot walk</li>
            <li>Severe foot wounds or heavy drooling + dehydration</li>
            <li>Calf is weak (young animals can worsen fast)</li>
        </ul>
    `
};

async function typeWriterEffect(htmlText, elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = "";
    let i = 0;
    let isTag = false;
    let currentHtml = "";

    while (i < htmlText.length) {
        let char = htmlText.charAt(i);
        if (char === '<') { isTag = true; }
        
        currentHtml += char;
        
        if (char === '>') { isTag = false; }
        
        element.innerHTML = currentHtml;
        
        if (!isTag) {
            await new Promise(r => setTimeout(r, 10)); 
        }
        i++;
    }
}

document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files[0]) {
        alert('Please select an image first!');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    document.getElementById('predictBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('treatmentSection').classList.add('hidden');
    document.getElementById('heatmapContainer').classList.add('hidden');
    document.getElementById('treatmentText').innerHTML = "";

    try {
        const response = await fetch('/predict', { method: 'POST', body: formData });
        const data = await response.json();
        
        document.getElementById('loading').classList.add('hidden');
        const resultCard = document.getElementById('resultCard');
        resultCard.classList.remove('hidden');

        if (data.status === 'success') {
            resultCard.className = 'success-bg';
            
            let color = data.prediction === 'Healthy' ? 'green' : 'red';
            document.getElementById('diseaseName').innerHTML = `Disease Detected: <span style="color:${color}; font-weight:bold;">${data.prediction}</span>`;
            document.getElementById('confidenceLevel').innerText = "Confidence Score: " + data.confidence;

            if (data.heatmap_url) {
                document.getElementById('heatmapImage').src = data.heatmap_url + "?t=" + new Date().getTime();
                document.getElementById('heatmapContainer').classList.remove('hidden');
            }

            if (data.prediction === "Lumpy" || data.prediction === "Foot-and-Mouth") {
                document.getElementById('treatmentSection').classList.remove('hidden');
                typeWriterEffect(treatments[data.prediction], 'treatmentText');
            }

        } else {
            resultCard.className = 'error-bg';
            document.getElementById('diseaseName').innerText = "Image Rejected!";
            document.getElementById('confidenceLevel').innerText = data.prediction;
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Something went wrong!');
        document.getElementById('loading').classList.add('hidden');
    } finally {
        document.getElementById('predictBtn').disabled = false;
    }
});

document.getElementById('resetBtn').addEventListener('click', function() {
    document.getElementById('fileInput').value = '';
    
    document.getElementById('resultCard').classList.add('hidden');
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('treatmentSection').classList.add('hidden');
    document.getElementById('heatmapContainer').classList.add('hidden');
    
    document.getElementById('dropZone').classList.remove('hidden');
    
    document.getElementById('treatmentText').innerHTML = '';
    document.getElementById('heatmapImage').src = '';
    document.getElementById('predictBtn').disabled = false;
});