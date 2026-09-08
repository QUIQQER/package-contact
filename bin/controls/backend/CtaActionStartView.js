/**
 * Start view select ("Ansicht beim Öffnen") for the CTA action brick.
 *
 * Extends the native select of the brick setting: the "Auswahl" and "KI Agent"
 * options are only kept when the AI agent view is available. When it is not
 * available, only the "Formular" option remains and a previously selected
 * AI-agent-dependent option falls back to the form.
 *
 * Availability means "some installed package offers an ai agent brick", not
 * "this project already contains one" - the latter is the job of the brick
 * picker in the accompanying "KI-Agent-Baustein" setting.
 *
 * It also toggles the fields that only matter for an ai view, declared with:
 *
 *   data-dependency="startView"
 *   data-dependency-options="select,ai"
 *
 * The evaluation mirrors package/quiqqer/core/bin/QUI/controls/settings/Dependency,
 * because QUI.parse allows only one data-qui control per element and this
 * control already owns the select.
 *
 * @module package/quiqqer/contact/bin/controls/backend/CtaActionStartView
 */
define('package/quiqqer/contact/bin/controls/backend/CtaActionStartView', [

    'qui/controls/Control',
    'Ajax'

], function (QUIControl, QUIAjax) {
    "use strict";

    // view options that require the AI agent view to be available
    const AI_AGENT_VIEWS = ['select', 'ai'];

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
                this.$Select.value = 'form';
                this.$Select.dispatchEvent(new Event('change'));
            }

            // the ai fields have to follow even when nothing was selected, so
            // they do not stay visible for a view that no longer exists
            this.$applyDependencies();
        }
    });
});
