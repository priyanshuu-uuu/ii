(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const text = $('qrText');
  const qrTarget = $('qrcode');
  const logoInput = $('logoInput');
  let logoImage = null;
  let qrCode = null;

  const correctionLevels = { L: QRCode.CorrectLevel.L, M: QRCode.CorrectLevel.M, Q: QRCode.CorrectLevel.Q, H: QRCode.CorrectLevel.H };

  function hex(value) { return value.toUpperCase(); }

  function updateLabels() {
    $('charCount').textContent = `${text.value.length} / 1000`;
    $('foregroundValue').textContent = hex($('foreground').value);
    $('backgroundValue').textContent = hex($('background').value);
    $('sizeValue').textContent = `${$('size').value} px`;
    $('metaSize').textContent = `${$('size').value} × ${$('size').value}`;
    $('metaLevel').textContent = ({ L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' })[$('level').value];
  }

  function drawLogo(canvas) {
    if (!logoImage || !canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width * 0.2;
    const x = (canvas.width - size) / 2;
    const y = (canvas.height - size) / 2;
    const padding = size * 0.14;
    ctx.fillStyle = $('background').value;
    ctx.beginPath();
    ctx.roundRect(x - padding, y - padding, size + padding * 2, size + padding * 2, size * .16);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, size * .12);
    ctx.clip();
    const ratio = Math.max(size / logoImage.width, size / logoImage.height);
    const width = logoImage.width * ratio;
    const height = logoImage.height * ratio;
    ctx.drawImage(logoImage, x + (size - width) / 2, y + (size - height) / 2, width, height);
    ctx.restore();
  }

  function generate() {
    const value = text.value.trim();
    qrTarget.innerHTML = '';
    if (!value) {
      $('emptyState').style.display = 'block';
      return;
    }
    $('emptyState').style.display = 'none';
    const size = Number($('size').value);
    qrCode = new QRCode(qrTarget, {
      text: value,
      width: size,
      height: size,
      colorDark: $('foreground').value,
      colorLight: $('background').value,
      correctLevel: correctionLevels[$('level').value]
    });
    window.setTimeout(() => drawLogo(qrTarget.querySelector('canvas')), 20);
  }

  function download() {
    const canvas = qrTarget.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'qr-code-studio.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function toggleLogo() {
    const enabled = $('logoToggle').checked;
    logoInput.disabled = !enabled;
    $('logoUpload').classList.toggle('is-disabled', !enabled);
    if (!enabled) { logoImage = null; $('logoLabel').textContent = 'Upload PNG or JPG'; $('removeLogo').hidden = true; generate(); }
  }

  text.addEventListener('input', () => { updateLabels(); generate(); });
  ['foreground', 'background', 'size', 'level'].forEach((id) => $(id).addEventListener('input', () => { updateLabels(); generate(); }));
  $('logoToggle').addEventListener('change', toggleLogo);
  logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { logoImage = new Image(); logoImage.onload = generate; logoImage.src = event.target.result; };
    reader.readAsDataURL(file);
    $('logoLabel').textContent = file.name;
    $('removeLogo').hidden = false;
  });
  $('removeLogo').addEventListener('click', (event) => { event.preventDefault(); logoInput.value = ''; logoImage = null; $('logoLabel').textContent = 'Upload PNG or JPG'; $('removeLogo').hidden = true; generate(); });
  $('downloadButton').addEventListener('click', download);
  $('resetButton').addEventListener('click', () => { text.value = 'https://qr-code.studio'; $('foreground').value = '#121827'; $('background').value = '#ffffff'; $('size').value = 360; $('level').value = 'M'; $('logoToggle').checked = false; toggleLogo(); updateLabels(); generate(); });

  updateLabels();
  generate();
})();
