/** Start view availability and a non-blocking configuration hint. */
define('package/quiqqer/contact/bin/controls/backend/CtaActionStartView', [

    'qui/controls/Control',
    'Ajax',
    'Locale'

], function (QUIControl, QUIAjax, Locale) {
    "use strict";

    // view options that require the AI agent view to be available
    const AI_AGENT_VIEWS = ['ai'];

    return new Class({

        Extends: QUIControl,
        Type: 'package/quiqqer/contact/bin/controls/backend/CtaActionStartView',

        Binds: [
            '$onImport',
            '$applyDependencies'
        ],

        initialize: function (options) {
            this.parent(options);

            this.$Select = null;
            this.$Fields = [];

            this.addEvents({
                onImport: this.$onImport
            });
        },

        $onImport: function () {
            const Elm = this.getElm();

            this.$Select = Elm.nodeName === 'SELECT' ? Elm : Elm.querySelector('select');

            if (!this.$Select) {
                return;
            }

            const Scope = this.$Select.closest('form') || this.$Select.closest('table');

            if (Scope) {
                this.$groupSettings(Scope);
                this.$initActionHint(Scope);
                this.$Fields = Array.from(
                    Scope.querySelectorAll('[data-dependency="' + this.$Select.name + '"]')
                );
            }

            this.$Select.addEventListener('change', this.$applyDependencies);
            this.$applyDependencies();

            QUIAjax.get('package_quiqqer_contact_ajax_ctaAction_isAiAgentViewAvailable', (available) => {
                if (available) {
                    return;
                }

                this.$removeAiAgentOptions();
            }, {
                'package': 'quiqqer/contact'
            });
        },

        $groupSettings: function (scope) {
            [['startView', 'start'], ['formEnabled', 'offers'], ['btnStyle', 'appearance']].forEach(([name, section]) => {
                const row = scope.querySelector('[name="' + name + '"]')?.closest('tr');
                if (!row) {
                    return;
                }
                const heading = document.createElement('tr');
                const cell = document.createElement('th');
                cell.colSpan = 2;
                cell.textContent = Locale.get('quiqqer/contact', 'contact.ctaAction.section.' + section);
                heading.appendChild(cell);
                row.before(heading);
            });
        },

        $initActionHint: function (scope) {
            const hint = document.createElement('p');
            hint.setAttribute('role', 'status');
            hint.textContent = Locale.get('quiqqer/contact', 'contact.ctaAction.noActions');
            hint.hidden = true;
            this.$Select.parentElement.appendChild(hint);
            let request = 0;

            const update = () => {
                const field = (name) => scope.querySelector('[name="' + name + '"]');
                const form = field('formEnabled');
                const formEnabled = !form || (form.type === 'checkbox' ? form.checked : form.value === '1');
                const formOption = this.$Select.querySelector('option[value="form"]');

                if (formOption) {
                    formOption.disabled = !formEnabled;
                }

                if (!formEnabled && this.$Select.value === 'form') {
                    this.$Select.value = 'select';
                    this.$Select.dispatchEvent(new Event('change'));
                }

                let buttons = [];
                try { buttons = JSON.parse(field('customButtons')?.value || '[]'); } catch (e) { /* Empty configuration. */ }
                const custom = Array.isArray(buttons) && buttons.some((button) => {
                    if (!button || [true, 1, '1'].includes(button.isDisabled) || [true, 1, '1'].includes(button.disabled)) {
                        return false;
                    }
                    const named = String(button.text || button.ariaLabel || button.title || '').trim();
                    return named && (button.group !== 'secondary' || button.display !== 'icon' || button.iconClass || button.icon);
                });
                const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field('email')?.value || '');
                const phone = ['phone', 'whatsapp'].some((name) => /\d/.test(field(name)?.value || ''));
                const current = ++request;
                hint.hidden = true;

                if (formEnabled || custom || email || phone) {
                    return;
                }

                QUIAjax.get('package_quiqqer_contact_ajax_ctaAction_isAiAgentViewAvailable', (available) => {
                    if (current === request && hint.isConnected) {
                        hint.hidden = Boolean(available);
                    }
                }, {
                    'package': 'quiqqer/contact',
                    aiBrickId: field('aiBrickId')?.value || '0'
                });
            };

            scope.addEventListener('change', update);
            scope.addEventListener('input', update);
            this.addEvent('destroy', () => {
                scope.removeEventListener('change', update);
                scope.removeEventListener('input', update);
            });
            update();
        },

        /**
         * Show or hide the fields that declared a dependency on this select.
         */
        $applyDependencies: function () {
            const value = this.$Select.value;

            this.$Fields.forEach(function (Field) {
                const entries = (Field.getAttribute('data-dependency-options') || '')
                    .split(',')
                    .map(function (entry) {
                        return entry.trim();
                    });

                const visible = entries.indexOf('*') !== -1 || entries.indexOf(value) !== -1;

                const Row = Field.closest('[data-dependency-row]')
                    || Field.closest('tr')
                    || Field;

                Row.style.display = visible ? null : 'none';
            });
        },

        /**
         * Remove the options that depend on the AI agent view and fall back to
         * the form view when one of them was selected.
         */
        $removeAiAgentOptions: function () {
            let wasSelected = false;

            AI_AGENT_VIEWS.forEach((value) => {
                const Option = this.$Select.querySelector('option[value="' + value + '"]');

                if (!Option) {
                    return;
                }

                if (Option.selected) {
                    wasSelected = true;
                }

                Option.remove();
            });

            if (wasSelected) {
                this.$Select.value = 'select';
                this.$Select.dispatchEvent(new Event('change'));
            }

            // the ai fields have to follow even when nothing was selected, so
            // they do not stay visible for a view that no longer exists
            this.$applyDependencies();
        }
    });
});
