(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const text = $('qrText');
  const qrTarget = $('qrcode');
  const logoInput = $('logoInput');
  const logoUpload = $('logoUpload');
  const logoToggle = $('logoToggle');
  const removeLogoButton = $('removeLogo');

  let logoImage = null;
  let qrCode = null;

  const correctionLevels = {
    L: QRCode.CorrectLevel.L,
    M: QRCode.CorrectLevel.M,
    Q: QRCode.CorrectLevel.Q,
    H: QRCode.CorrectLevel.H,
  };

  function hex(value) {
    return value.toUpperCase();
  }

  function updateLabels() {
    $('charCount').textContent = `${text.value.length} / 1000`;
    $('foregroundValue').textContent = hex($('foreground').value);
    $('backgroundValue').textContent = hex($('background').value);
    $('sizeValue').textContent = `${$('size').value} px`;
    $('metaSize').textContent = `${$('size').value} × ${$('size').value}`;
    $('metaLevel').textContent = ({ L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' })[$('level').value];
  }

  function syncLogoState() {
    const enabled = logoToggle.checked;
    const hasImage = Boolean(logoImage);

    logoInput.disabled = !enabled;
    logoUpload.classList.toggle('is-disabled', !enabled);
    removeLogoButton.hidden = !(enabled && hasImage);
    $('logoLabel').textContent = enabled && hasImage ? (logoInput.files?.[0]?.name || 'Logo ready') : 'Upload PNG or JPG';
  }

  function drawLogo(canvas) {
    if (!canvas || !logoToggle.checked || !logoImage) return;

    const ctx = canvas.getContext('2d');
    const side = Math.min(canvas.width, canvas.height);
    const logoSize = side * 0.22;
    const inset = (side - logoSize) / 2;
    const radius = logoSize * 0.22;
    const backgroundColor = $('background').value;

    ctx.save();
    ctx.shadowColor = 'rgba(10, 14, 24, 0.26)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.roundRect(inset - 14, inset - 14, logoSize + 28, logoSize + 28, radius + 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = backgroundColor;
    ctx.beginPath();
    ctx.roundRect(inset, inset, logoSize, logoSize, radius);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(inset, inset, logoSize, logoSize, radius);
    ctx.clip();

    const ratio = Math.min(logoSize / logoImage.width, logoSize / logoImage.height);
    const drawWidth = logoImage.width * ratio;
    const drawHeight = logoImage.height * ratio;
    const drawX = inset + (logoSize - drawWidth) / 2;
    const drawY = inset + (logoSize - drawHeight) / 2;

    ctx.drawImage(logoImage, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, side * 0.003);
    ctx.beginPath();
    ctx.roundRect(inset, inset, logoSize, logoSize, radius);
    ctx.stroke();
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
      correctLevel: correctionLevels[$('level').value],
    });

    window.setTimeout(() => {
      const canvas = qrTarget.querySelector('canvas');
      drawLogo(canvas);
    }, 30);
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
    const enabled = logoToggle.checked;
    logoInput.disabled = !enabled;
    logoUpload.classList.toggle('is-disabled', !enabled);

    if (!enabled) {
      removeLogoButton.hidden = true;
    } else if (logoImage) {
      removeLogoButton.hidden = false;
    }

    generate();
  }

  text.addEventListener('input', () => {
    updateLabels();
    generate();
  });

  ['foreground', 'background', 'size', 'level'].forEach((id) => {
    $(id).addEventListener('input', () => {
      updateLabels();
      generate();
    });
  });

  logoToggle.addEventListener('change', toggleLogo);

  logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (!file) return;

    const isValidType = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isValidType) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        logoImage = image;
        syncLogoState();
        generate();
      };
      image.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  removeLogoButton.addEventListener('click', (event) => {
    event.preventDefault();
    logoInput.value = '';
    logoImage = null;
    syncLogoState();
    generate();
  });

  $('downloadButton').addEventListener('click', download);

  $('resetButton').addEventListener('click', () => {
    text.value = 'https://qr-code.studio';
    $('foreground').value = '#121827';
    $('background').value = '#ffffff';
    $('size').value = 360;
    $('level').value = 'M';
    logoToggle.checked = false;
    logoInput.value = '';
    logoImage = null;
    syncLogoState();
    updateLabels();
    generate();
  });

  updateLabels();
  syncLogoState();
  generate();
})();
