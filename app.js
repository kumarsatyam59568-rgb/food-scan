// ===== FoodScan — Main Application =====

// ===== DOM Elements =====
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.querySelector('.nav-links');
const scanTabs = document.querySelectorAll('.scan-tab');
const cameraContainer = document.getElementById('cameraContainer');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const barcodeInput = document.getElementById('barcodeInput');
const searchBtn = document.getElementById('searchBtn');
const sampleBtns = document.querySelectorAll('.sample-btn');
const resultsPlaceholder = document.getElementById('resultsPlaceholder');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const productResult = document.getElementById('productResult');
const historyGrid = document.getElementById('historyGrid');
const historyEmpty = document.getElementById('historyEmpty');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// ===== State =====
let isCameraActive = false;
let scanHistory = JSON.parse(localStorage.getItem('foodscan_history') || '[]');

// ===== Mobile Menu =====
mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    mobileMenuBtn.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        mobileMenuBtn.classList.remove('active');
    });
});

// ===== Active Nav Link on Scroll =====
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const scrollY = window.scrollY + 100;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-links a[href="#${id}"]`);
        if (link) {
            if (scrollY >= top && scrollY < top + height) {
                document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
});

// ===== Scanner Tabs =====
scanTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Deactivate all
        scanTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        // Activate selected
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(`${tabId}-tab`).classList.add('active');

        // Stop camera if switching away
        if (tabId !== 'camera' && isCameraActive) {
            stopCamera();
        }
    });
});

// ===== Camera Scanner (QuaggaJS) =====
startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);

function startCamera() {
    cameraContainer.classList.add('active');
    stopCameraBtn.style.display = 'inline-flex';

    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-viewport'),
            constraints: {
                facingMode: "environment",
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        },
        decoder: {
            readers: [
                "ean_reader",
                "ean_8_reader",
                "upc_reader",
                "upc_e_reader",
                "code_128_reader"
            ]
        },
        locate: true
    }, function(err) {
        if (err) {
            console.error('Camera error:', err);
            alert('Could not access camera. Please check permissions or use Manual Entry.');
            stopCamera();
            return;
        }
        Quagga.start();
        isCameraActive = true;
    });

    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        if (code) {
            // Vibrate on detection if supported
            if (navigator.vibrate) navigator.vibrate(200);

            stopCamera();
            lookupProduct(code);
        }
    });
}

function stopCamera() {
    try {
        Quagga.stop();
    } catch (e) {
        // Quagga might not be initialized
    }
    isCameraActive = false;
    cameraContainer.classList.remove('active');
    stopCameraBtn.style.display = 'none';
}

// ===== Manual Search =====
searchBtn.addEventListener('click', () => {
    const barcode = barcodeInput.value.trim();
    if (barcode) {
        lookupProduct(barcode);
    }
});

barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const barcode = barcodeInput.value.trim();
        if (barcode) lookupProduct(barcode);
    }
});

// Sample barcodes
sampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const barcode = btn.dataset.barcode;
        barcodeInput.value = barcode;
        lookupProduct(barcode);
    });
});

// Retry button
retryBtn.addEventListener('click', () => {
    showState('placeholder');
});

// ===== API Lookup (Open Food Facts) =====
async function lookupProduct(barcode) {
    showState('loading');

    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();

        if (data.status === 1 && data.product) {
            displayProduct(data.product, barcode);
            addToHistory(data.product, barcode);
        } else {
            errorMessage.textContent = `No product found for barcode: ${barcode}`;
            showState('error');
        }
    } catch (err) {
        console.error('API Error:', err);
        errorMessage.textContent = 'Network error. Please check your connection and try again.';
        showState('error');
    }
}

// ===== Display States =====
function showState(state) {
    resultsPlaceholder.classList.add('hidden');
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    productResult.classList.add('hidden');

    switch (state) {
        case 'placeholder': resultsPlaceholder.classList.remove('hidden'); break;
        case 'loading': loadingState.classList.remove('hidden'); break;
        case 'error': errorState.classList.remove('hidden'); break;
        case 'product': productResult.classList.remove('hidden'); break;
    }
}

// ===== Display Product =====
function displayProduct(product, barcode) {
    const name = product.product_name || 'Unknown Product';
    const brand = product.brands || 'Unknown Brand';
    const image = product.image_front_small_url || product.image_url || '';
    const nutriScore = (product.nutriscore_grade || product.nutrition_grades || '').toLowerCase();
    const calories = product.nutriments?.['energy-kcal_100g'] ?? product.nutriments?.['energy-kcal'] ?? '—';
    const proteins = product.nutriments?.proteins_100g ?? '—';
    const carbs = product.nutriments?.carbohydrates_100g ?? '—';
    const fat = product.nutriments?.fat_100g ?? '—';
    const fiber = product.nutriments?.fiber_100g ?? '—';
    const sugar = product.nutriments?.sugars_100g ?? '—';
    const salt = product.nutriments?.salt_100g ?? '—';
    const sodium = product.nutriments?.sodium_100g ?? '—';
    const ingredients = product.ingredients_text || product.ingredients_text_en || 'Not available';
    const allergens = product.allergens_tags || [];
    const categories = (product.categories || '').split(',').slice(0, 3).map(c => c.trim()).filter(Boolean);

    // Build tags
    let tagsHTML = '';
    if (product.labels_tags) {
        const labels = product.labels_tags.slice(0, 4);
        labels.forEach(label => {
            const clean = label.replace(/^en:/, '').replace(/-/g, ' ');
            tagsHTML += `<span class="tag tag-green">${capitalize(clean)}</span>`;
        });
    }
    categories.forEach(cat => {
        tagsHTML += `<span class="tag tag-blue">${cat}</span>`;
    });

    // Nutri-Score bar
    const scores = ['a', 'b', 'c', 'd', 'e'];
    let nutriScoreHTML = '<div class="nutriscore-bar">';
    scores.forEach(s => {
        const isActive = s === nutriScore ? 'active' : '';
        nutriScoreHTML += `<div class="nutriscore-item ns-${s} ${isActive}">${s.toUpperCase()}</div>`;
    });
    nutriScoreHTML += '</div>';

    // Allergens
    let allergensHTML = '';
    if (allergens.length > 0) {
        const allergenItems = allergens.map(a => {
            const clean = a.replace(/^en:/, '').replace(/-/g, ' ');
            return `<span class="allergen-tag">${capitalize(clean)}</span>`;
        }).join('');
        allergensHTML = `
            <div class="allergens-section">
                <h4>⚠️ Allergens</h4>
                <div class="allergen-list">${allergenItems}</div>
            </div>
        `;
    }

    productResult.innerHTML = `
        <div class="product-header">
            ${image ? `<img src="${image}" alt="${name}" class="product-image">` : ''}
            <div class="product-info">
                <h3>${escapeHTML(name)}</h3>
                <div class="product-brand">${escapeHTML(brand)} · ${barcode}</div>
                <div class="product-tags">${tagsHTML}</div>
            </div>
        </div>

        ${nutriScore ? nutriScoreHTML : ''}

        <div class="nutrition-grid">
            <div class="nutrition-item">
                <span class="nutrition-label">🔥 Calories</span>
                <span class="nutrition-value">${formatNum(calories)} kcal</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🥩 Proteins</span>
                <span class="nutrition-value">${formatNum(proteins)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🍞 Carbs</span>
                <span class="nutrition-value">${formatNum(carbs)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🧈 Fat</span>
                <span class="nutrition-value">${formatNum(fat)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🍬 Sugar</span>
                <span class="nutrition-value">${formatNum(sugar)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🌾 Fiber</span>
                <span class="nutrition-value">${formatNum(fiber)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">🧂 Salt</span>
                <span class="nutrition-value">${formatNum(salt)} g</span>
            </div>
            <div class="nutrition-item">
                <span class="nutrition-label">⚗️ Sodium</span>
                <span class="nutrition-value">${formatNum(sodium)} g</span>
            </div>
        </div>

        <div class="ingredients-section">
            <h4>📋 Ingredients</h4>
            <div class="ingredients-text">${escapeHTML(ingredients)}</div>
        </div>

        ${allergensHTML}
    `;

    showState('product');

    // Scroll to results on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('resultsArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ===== History =====
function addToHistory(product, barcode) {
    const entry = {
        barcode,
        name: product.product_name || 'Unknown Product',
        brand: product.brands || 'Unknown Brand',
        image: product.image_front_small_url || product.image_url || '',
        nutriScore: (product.nutriscore_grade || product.nutrition_grades || '').toLowerCase(),
        calories: product.nutriments?.['energy-kcal_100g'] ?? '—',
        timestamp: new Date().toISOString()
    };

    // Remove duplicate if exists
    scanHistory = scanHistory.filter(h => h.barcode !== barcode);
    // Add to front
    scanHistory.unshift(entry);
    // Keep max 20
    scanHistory = scanHistory.slice(0, 20);

    localStorage.setItem('foodscan_history', JSON.stringify(scanHistory));
    renderHistory();
}

function renderHistory() {
    if (scanHistory.length === 0) {
        historyGrid.innerHTML = `
            <div class="history-empty" id="historyEmpty">
                <span>📋</span>
                <p>No scan history yet. Start scanning products!</p>
            </div>
        `;
        return;
    }

    historyGrid.innerHTML = scanHistory.map(item => {
        const scoreClass = item.nutriScore ? `score-${item.nutriScore}` : '';
        const scoreLabel = item.nutriScore ? item.nutriScore.toUpperCase() : '—';
        const date = new Date(item.timestamp).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });

        return `
            <div class="history-card" onclick="lookupProduct('${item.barcode}')">
                <div class="history-card-header">
                    ${item.image ?
                        `<img src="${item.image}" alt="${escapeHTML(item.name)}" class="history-card-img">` :
                        '<div class="history-card-img" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🍽️</div>'
                    }
                    <div>
                        <div class="history-card-name">${escapeHTML(item.name)}</div>
                        <div class="history-card-brand">${escapeHTML(item.brand)}</div>
                    </div>
                </div>
                <div class="history-card-meta">
                    <span>${date}</span>
                    <span class="history-card-score ${scoreClass}">Nutri: ${scoreLabel}</span>
                </div>
            </div>
        `;
    }).join('');
}

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all scan history?')) {
        scanHistory = [];
        localStorage.removeItem('foodscan_history');
        renderHistory();
    }
});

// ===== Utilities =====
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function capitalize(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatNum(val) {
    if (val === '—' || val === undefined || val === null) return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return num % 1 === 0 ? num.toString() : num.toFixed(1);
}

// ===== Initialize =====
renderHistory();

