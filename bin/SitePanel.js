/**
 * Contact form
 *
 * @module package/quiqqer/contact/bin/SitePanel
 * @author www.pcsg.de (Henning Leutz)
 *
 * @require qui/QUI
 * @require qui/controls/Control
 * @require package/quiqqer/formbuilder/bin/FormBuilder
 */
define('package/quiqqer/contact/bin/SitePanel', [

    'qui/QUI',
    'qui/controls/Control',
    'package/quiqqer/formbuilder/bin/FormBuilder'

], function (QUI, QUIControl, FormBuilder) {
    "use strict";

    var lg = 'quiqqer/contact';

    return new Class({

        Extends: QUIControl,
        Type   : 'package/quiqqer/contact/bin/SitePanel',

        Binds: [
            '$onInject',
            '$onDestroy'
        ],

        options: {
            Site: false
        },

        initialize: function (options) {
            this.parent(options);

            this.$Panel   = this.getAttribute('Panel');
            this.$Site    = this.getAttribute('Site');
            this.$Project = this.$Site.getProject();
            this.$Form    = new FormBuilder();

            this.addEvents({
                onInject : this.$onInject,
                onDestroy: this.$onDestroy
            });
        },

        /**
         * create the dom node element
         *
         * @return {HTMLElement}
         */
        create: function () {

            this.$Elm = new Element('div', {
                styles: {
                    'float': 'left',
                    height : '100%',
                    width  : '100%'
                }
            });

            this.$Form.inject(this.$Elm);

            return this.$Elm;
        },

        /**
         * event : on inject
         */
        $onInject: function () {

            var formData = this.$Site.getAttribute(
                'quiqqer.contact.settings.form'
            );

            formData = JSON.decode(formData);

            if (formData) {
                this.$Form.load(formData);
            }

            this.$Panel.minimizeCategory();
            this.$Panel.getContent().setStyle('padding', 0);
        },

        /**
         * event : on destroy
         * set the tags to the site
         */
        $onDestroy: function () {

            this.$Panel.maximizeCategory();
            this.$Panel.getContent().setStyle('padding', null);

            this.$Site.setAttribute(
                'quiqqer.contact.settings.form',
                JSON.encode(this.$Form.save())
            );
        }
    });
});
