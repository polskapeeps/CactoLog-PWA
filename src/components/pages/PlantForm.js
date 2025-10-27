import { Component } from '../../core/Component.js';
import { router } from '../../core/Router.js';
import { toISODate } from '../../utils/helpers.js';
import { validatePlant } from '../../utils/validators.js';
import { ImageUpload } from '../shared/ImageUpload.js';
import { showSuccess, showError } from '../shared/Toast.js';
import { showLoading, hideLoading } from '../shared/Loading.js';

/**
 * Plant form page component (create/edit)
 * @class
 */
export class PlantForm extends Component {
  constructor(container, { plantService, imageService, photoRepo }) {
    super(container);
    this.plantService = plantService;
    this.imageService = imageService;
    this.photoRepo = photoRepo;

    this.state = {
      plant: null,
      isEditMode: false,
      uploadedPhotos: []
    };
  }

  async mounted() {
    const params = router.getParams();

    if (params.id && params.id !== 'new') {
      // Edit mode
      try {
        const plant = await this.plantService.getPlant(params.id);
        if (plant) {
          this.setState({ plant, isEditMode: true });
        } else {
          showError('Plant not found');
          router.navigate('/plants');
        }
      } catch (err) {
        showError(`Failed to load plant: ${err.message}`);
        router.navigate('/plants');
      }
    }

    this.render();
  }

  render() {
    const { plant, isEditMode } = this.state;

    const form = this.el('section', { className: 'section plant-form' }, [
      this.el('h2', {}, isEditMode ? 'Edit Plant' : 'New Plant'),

      this.el('form', {
        id: 'plantForm',
        onSubmit: (e) => this.handleSubmit(e)
      }, [
        // Basic info
        this.el('div', { className: 'form-section' }, [
          this.el('h3', {}, 'Basic Information'),

          this.el('div', { className: 'form-grid' }, [
            this.el('label', {}, [
              'Name *',
              this.el('input', {
                name: 'name',
                type: 'text',
                required: true,
                placeholder: 'e.g., Golden Barrel',
                value: plant?.name || ''
              })
            ]),

            this.el('label', {}, [
              'Species',
              this.el('input', {
                name: 'species',
                type: 'text',
                placeholder: 'e.g., Echinocactus grusonii',
                value: plant?.species || ''
              })
            ]),

            this.el('label', {}, [
              'Type',
              this.el('select', {
                name: 'type',
                value: plant?.type || 'cactus'
              }, [
                this.el('option', { value: 'cactus' }, 'Cactus'),
                this.el('option', { value: 'succulent' }, 'Succulent'),
                this.el('option', { value: 'foliage' }, 'Foliage'),
                this.el('option', { value: 'other' }, 'Other')
              ])
            ]),

            this.el('label', {}, [
              'Location',
              this.el('input', {
                name: 'location',
                type: 'text',
                placeholder: 'e.g., South window',
                value: plant?.location || ''
              })
            ])
          ])
        ]),

        // Watering
        this.el('div', { className: 'form-section' }, [
          this.el('h3', {}, 'Watering Schedule'),

          this.el('div', { className: 'form-grid' }, [
            this.el('label', {}, [
              'Water interval (days)',
              this.el('input', {
                name: 'waterIntervalDays',
                type: 'number',
                min: '1',
                max: '365',
                value: plant?.waterIntervalDays || '14'
              })
            ]),

            this.el('label', {}, [
              'Last watered',
              this.el('input', {
                name: 'lastWatered',
                type: 'date',
                value: plant?.lastWatered || toISODate(new Date())
              })
            ])
          ])
        ]),

        // Repotting
        this.el('div', { className: 'form-section' }, [
          this.el('h3', {}, 'Repotting'),

          this.el('div', { className: 'form-grid' }, [
            this.el('label', {}, [
              'Repot interval (months)',
              this.el('input', {
                name: 'repotIntervalMonths',
                type: 'number',
                min: '0',
                max: '120',
                value: plant?.repotIntervalMonths || '12'
              })
            ]),

            this.el('label', {}, [
              'Last repot',
              this.el('input', {
                name: 'lastRepot',
                type: 'date',
                value: plant?.lastRepot || ''
              })
            ])
          ])
        ]),

        // Additional info
        this.el('div', { className: 'form-section' }, [
          this.el('h3', {}, 'Additional Information'),

          this.el('label', {}, [
            'Tags (comma separated)',
            this.el('input', {
              name: 'tags',
              type: 'text',
              placeholder: 'e.g., spiny, drought-tolerant',
              value: plant?.tags || ''
            })
          ]),

          this.el('label', {}, [
            'Notes',
            this.el('textarea', {
              name: 'notes',
              rows: '4',
              placeholder: 'Care notes, observations...',
              value: plant?.notes || ''
            })
          ])
        ]),

        // Photos
        this.el('div', { className: 'form-section' }, [
          this.el('h3', {}, 'Photos'),
          this.el('div', { id: 'photoUploadContainer' })
        ]),

        // Actions
        this.el('div', { className: 'form-actions' }, [
          this.el('button', {
            type: 'button',
            className: 'btn',
            onClick: () => router.navigate('/plants')
          }, 'Cancel'),
          this.el('button', {
            type: 'submit',
            className: 'primary-btn'
          }, isEditMode ? 'Save Changes' : 'Create Plant')
        ])
      ])
    ]);

    this.container.innerHTML = '';
    this.container.appendChild(form);

    // Mount ImageUpload component
    this.mountImageUpload();
  }

  mountImageUpload() {
    const container = this.$('#photoUploadContainer');
    if (!container) return;

    const imageUpload = new ImageUpload(container, {
      enableCamera: true,
      enableDragDrop: true,
      onUpload: (file) => this.handlePhotoUpload(file)
    });

    imageUpload.render();
  }

  async handlePhotoUpload(file) {
    try {
      showLoading();

      // Compress image
      const compressedBlob = await this.imageService.compressImage(file);

      // Generate photo ID
      const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Save to IndexedDB
      await this.photoRepo.savePhoto(photoId, compressedBlob);

      // Add to uploaded photos
      this.state.uploadedPhotos.push(photoId);

      hideLoading();
      showSuccess('Photo uploaded!');
    } catch (err) {
      hideLoading();
      showError(`Failed to upload photo: ${err.message}`);
    }
  }

  async handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
      name: formData.get('name'),
      species: formData.get('species'),
      type: formData.get('type'),
      location: formData.get('location'),
      waterIntervalDays: parseInt(formData.get('waterIntervalDays'), 10),
      lastWatered: formData.get('lastWatered'),
      repotIntervalMonths: parseInt(formData.get('repotIntervalMonths'), 10),
      lastRepot: formData.get('lastRepot'),
      tags: formData.get('tags'),
      notes: formData.get('notes'),
      photoIds: this.state.uploadedPhotos
    };

    // Validate
    const validation = validatePlant(data);
    if (!validation.valid) {
      showError(validation.errors.join(', '));
      return;
    }

    try {
      showLoading();

      if (this.state.isEditMode) {
        // Update existing plant
        await this.plantService.updatePlant(this.state.plant.id, data);
        hideLoading();
        showSuccess('Plant updated!');
      } else {
        // Create new plant
        await this.plantService.createPlant(data);
        hideLoading();
        showSuccess('Plant created!');
      }

      router.navigate('/plants');
    } catch (err) {
      hideLoading();
      showError(`Failed to save plant: ${err.message}`);
    }
  }
}
