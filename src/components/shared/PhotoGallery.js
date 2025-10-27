import { Component } from '../../core/Component.js';

/**
 * Photo gallery component with lightbox
 * @class
 */
export class PhotoGallery extends Component {
  /**
   * @param {HTMLElement} container - Container
   * @param {Object} props - Props
   * @param {string[]} props.photoIds - Photo IDs
   * @param {Function} props.getPhotoURL - Function to get photo URL
   * @param {Function} props.onDelete - Delete callback
   */
  constructor(container, props) {
    super(container, props);
    this.state = {
      selectedIndex: null
    };
  }

  render() {
    const { photoIds, getPhotoURL } = this.props;

    if (!photoIds || photoIds.length === 0) {
      this.container.innerHTML = '<div class="empty">No photos</div>';
      return;
    }

    const gallery = this.el('div', { className: 'photo-gallery' },
      photoIds.map((photoId, index) =>
        this.el('div', { className: 'photo-item' }, [
          this.el('img', {
            src: getPhotoURL(photoId),
            alt: `Photo ${index + 1}`,
            className: 'photo-thumb',
            onClick: () => this.openLightbox(index)
          }),
          this.props.onDelete ? this.el('button', {
            className: 'photo-delete',
            'aria-label': 'Delete photo',
            onClick: (e) => {
              e.stopPropagation();
              this.props.onDelete(photoId, index);
            }
          }, '×') : null
        ])
      )
    );

    this.container.innerHTML = '';
    this.container.appendChild(gallery);

    // Render lightbox if photo is selected
    if (this.state.selectedIndex !== null) {
      this.renderLightbox();
    }
  }

  renderLightbox() {
    const { photoIds, getPhotoURL } = this.props;
    const { selectedIndex } = this.state;

    const lightbox = this.el('div', {
      className: 'lightbox',
      onClick: () => this.closeLightbox()
    }, [
      this.el('button', {
        className: 'lightbox-close',
        'aria-label': 'Close',
        onClick: () => this.closeLightbox()
      }, '×'),
      this.el('button', {
        className: 'lightbox-prev',
        'aria-label': 'Previous',
        onClick: (e) => {
          e.stopPropagation();
          this.navigate(-1);
        },
        disabled: selectedIndex === 0
      }, '‹'),
      this.el('button', {
        className: 'lightbox-next',
        'aria-label': 'Next',
        onClick: (e) => {
          e.stopPropagation();
          this.navigate(1);
        },
        disabled: selectedIndex === photoIds.length - 1
      }, '›'),
      this.el('img', {
        src: getPhotoURL(photoIds[selectedIndex]),
        alt: `Photo ${selectedIndex + 1}`,
        className: 'lightbox-image',
        onClick: (e) => e.stopPropagation()
      }),
      this.el('div', { className: 'lightbox-counter' },
        `${selectedIndex + 1} / ${photoIds.length}`
      )
    ]);

    document.body.appendChild(lightbox);

    // Keyboard navigation
    const handleKeydown = (e) => {
      if (e.key === 'Escape') this.closeLightbox();
      if (e.key === 'ArrowLeft') this.navigate(-1);
      if (e.key === 'ArrowRight') this.navigate(1);
    };

    document.addEventListener('keydown', handleKeydown);
    this.cleanupLightbox = () => {
      document.removeEventListener('keydown', handleKeydown);
      lightbox.remove();
    };
  }

  openLightbox(index) {
    this.setState({ selectedIndex: index });
  }

  closeLightbox() {
    if (this.cleanupLightbox) {
      this.cleanupLightbox();
      this.cleanupLightbox = null;
    }
    this.setState({ selectedIndex: null });
  }

  navigate(direction) {
    const { photoIds } = this.props;
    const { selectedIndex } = this.state;
    const newIndex = selectedIndex + direction;

    if (newIndex >= 0 && newIndex < photoIds.length) {
      this.closeLightbox();
      this.openLightbox(newIndex);
    }
  }

  beforeUnmount() {
    if (this.cleanupLightbox) {
      this.cleanupLightbox();
    }
  }
}
