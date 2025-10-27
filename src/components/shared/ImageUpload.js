import { Component } from '../../core/Component.js';
import { validateImage } from '../../utils/validators.js';

/**
 * Image upload component with drag-and-drop and camera support
 * @class
 */
export class ImageUpload extends Component {
  /**
   * @param {HTMLElement} container - Container
   * @param {Object} props - Props
   * @param {Function} props.onUpload - Upload callback (file) => void
   * @param {boolean} props.enableCamera - Enable camera
   * @param {boolean} props.enableDragDrop - Enable drag-drop
   * @param {string} props.label - Label text
   */
  constructor(container, props) {
    super(container, props);
    this.state = {
      isDragging: false,
      preview: null
    };
  }

  render() {
    const { label = 'Upload Photo', enableCamera = true, enableDragDrop = true } = this.props;
    const { isDragging, preview } = this.state;

    const dropzone = this.el('div', {
      className: `image-upload ${isDragging ? 'dragging' : ''}`,
      ...(enableDragDrop && {
        onDragover: (e) => this.handleDragOver(e),
        onDragleave: () => this.handleDragLeave(),
        onDrop: (e) => this.handleDrop(e)
      })
    }, [
      preview ? this.el('img', {
        src: preview,
        alt: 'Preview',
        className: 'upload-preview'
      }) : this.el('div', { className: 'upload-placeholder' }, [
        this.createUploadIcon(),
        this.el('p', {}, label)
      ]),
      this.el('input', {
        type: 'file',
        accept: 'image/*',
        className: 'upload-input',
        id: 'imageInput',
        onChange: (e) => this.handleFileSelect(e.target.files[0])
      }),
      this.el('div', { className: 'upload-actions' }, [
        this.el('label', {
          htmlFor: 'imageInput',
          className: 'btn'
        }, 'Choose File'),
        enableCamera && this.isCameraAvailable() ? this.el('button', {
          type: 'button',
          className: 'btn',
          onClick: () => this.handleCameraCapture()
        }, '📷 Camera') : null
      ])
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(dropzone);
  }

  handleDragOver(e) {
    e.preventDefault();
    this.setState({ isDragging: true });
  }

  handleDragLeave() {
    this.setState({ isDragging: false });
  }

  async handleDrop(e) {
    e.preventDefault();
    this.setState({ isDragging: false });

    const file = e.dataTransfer.files[0];
    if (file) {
      await this.handleFileSelect(file);
    }
  }

  async handleFileSelect(file) {
    if (!file) return;

    // Validate
    const validation = validateImage(file);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    // Show preview
    const preview = URL.createObjectURL(file);
    this.setState({ preview });

    // Call upload callback
    if (this.props.onUpload) {
      await this.props.onUpload(file);
    }
  }

  async handleCameraCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Create video element for camera preview
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.style.width = '100%';

      // Replace placeholder with video
      this.container.querySelector('.upload-placeholder')?.replaceWith(video);

      // Add capture button
      const captureBtn = this.el('button', {
        className: 'primary-btn',
        onClick: () => this.capturePhoto(video, stream)
      }, 'Capture');

      this.container.querySelector('.upload-actions')?.prepend(captureBtn);
    } catch (err) {
      alert('Failed to access camera: ' + err.message);
    }
  }

  capturePhoto(video, stream) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Stop camera
    stream.getTracks().forEach(track => track.stop());

    // Convert to blob
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
      await this.handleFileSelect(file);
    }, 'image/jpeg', 0.9);
  }

  isCameraAvailable() {
    return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  }

  createUploadIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    svg.setAttribute('class', 'upload-icon');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z');

    svg.appendChild(path);
    return svg;
  }

  beforeUnmount() {
    if (this.state.preview) {
      URL.revokeObjectURL(this.state.preview);
    }
  }
}
