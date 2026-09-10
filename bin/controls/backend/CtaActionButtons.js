define('package/quiqqer/contact/bin/controls/backend/CtaActionButtons', [
    'package/quiqqer/bricks/bin/Controls/ButtonsSettings',
    'Locale'
], function (ButtonsSettings, Locale) {
    "use strict";

    const label = (key) => Locale.get('quiqqer/contact', 'contact.ctaAction.' + key);

    return new Class({
        Extends: ButtonsSettings,
        Type: 'package/quiqqer/contact/bin/controls/backend/CtaActionButtons',

        $normalizeEntry: function (entry) {
            return Object.assign(this.parent(entry), {
                group: entry.group === 'secondary' ? 'secondary' : 'primary',
                display: ['text', 'icon'].includes(entry.display) ? entry.display : 'icon-text'
            });
        },

        refresh: function () {
            this.parent();

            // The shared editor projects a fixed set of fields into its rows.
            // Keep our local fields there as well for edit and reorder operations.
            const rows = this.$Grid.getData();
            rows.forEach((row, index) => {
                const entry = this.$normalizeEntry(this.$data[index]);
                row.group = entry.group;
                row.display = entry.display;
                row.preview = this.$createPreviewNode(entry);
            });
            this.$Grid.setData({data: rows});
        },

        update: function () {
            this.parent();
            this.$Input.dispatchEvent(new Event('change', {bubbles: true}));
        },

        $openAddDialog: function () {
            this.$adding = true;
            const result = this.parent();
            this.$adding = false;
            return result;
        },

        $createDialog: function () {
            const selected = this.$Grid.getSelectedIndices();
            const entry = this.$normalizeEntry(!this.$adding && selected.length ? this.$data[selected[0]] : {});

            return this.parent().then((Dialog) => {
                Dialog.addEvent('openAfterCreate', () => {
                    const fields = document.createElement('fieldset');
                    fields.dataset.name = 'ctaActionFields';
                    const legend = document.createElement('legend');
                    legend.textContent = label('group');
                    fields.appendChild(legend);

                    const addSelect = (name, values) => {
                        const wrapper = document.createElement('label');
                        wrapper.className = 'field-container';
                        const caption = document.createElement('span');
                        caption.className = 'field-container-item';
                        caption.textContent = label(name);
                        const select = document.createElement('select');
                        select.dataset.name = name;
                        select.className = 'field-container-field';
                        values.forEach((value) => select.add(new Option(label(name + '.' + value), value)));
                        select.value = entry[name];
                        wrapper.append(caption, select);
                        fields.appendChild(wrapper);
                        return select;
                    };

                    const group = addSelect('group', ['primary', 'secondary']);
                    const display = addSelect('display', ['icon-text', 'text', 'icon']);
                    const updateDisplay = () => {
                        const hidden = group.value !== 'secondary';
                        display.parentElement.hidden = hidden;
                        // The backend field-container class overrides the native hidden rule.
                        display.parentElement.style.display = hidden ? 'none' : '';
                    };
                    group.addEventListener('change', updateDisplay);
                    updateDisplay();
                    Dialog.getContent().prepend(fields);
                    this.$actionFields = fields;
                });
                Dialog.addEvent('close', () => { this.$actionFields = null; });
                return Dialog;
            });
        },

        $readActionFields: function (params) {
            if (this.$actionFields) {
                params.group = this.$actionFields.querySelector('[data-name="group"]').value;
                params.display = this.$actionFields.querySelector('[data-name="display"]').value;
            }

            return params;
        },

        add: function (params) {
            return this.parent(this.$readActionFields(params));
        },

        edit: function (index, params) {
            return this.parent(index, this.$readActionFields(params));
        },

        $createPreviewNode: function (entry) {
            const preview = document.createElement('span');
            const type = entry.btnType || (entry.group === 'secondary' ? '' : 'primary');
            preview.className = 'btn' + (type ? ' btn-' + type : '');
            const iconOnly = entry.group === 'secondary' && entry.display === 'icon';

            if (iconOnly) {
                preview.classList.add('btn-icon');
            }

            if ((entry.group !== 'secondary' || entry.display !== 'text') && entry.iconClass) {
                const icon = document.createElement('span');
                icon.className = entry.iconClass;
                icon.setAttribute('aria-hidden', 'true');
                preview.appendChild(icon);
            }

            const text = entry.text || entry.ariaLabel || entry.title || 'Button';
            preview.setAttribute('aria-label', text);
            preview.title = label('group.' + (entry.group || 'primary'));

            if (!iconOnly) {
                preview.appendChild(document.createTextNode(text));
            }

            return preview;
        }
    });
});
