/**
 * Contact form
 *
 * @module package/quiqqer/contact/bin/SitePanel
 * @author www.pcsg.de (Henning Leutz)
 * @author www.pcsg.de (Patrick Müller)
 */
define('package/quiqqer/contact/bin/SitePanel', [

    'qui/controls/Control',
    'package/quiqqer/formbuilder/bin/FormBuilder',
    'Ajax'

], function (QUIControl, FormBuilder, QUIAjax) {
    "use strict";

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

            return this.$Elm;
        },

        /**
         * event : on inject
         */
        $onInject: function () {
            var self     = this;
            var formData = this.$Site.getAttribute(
                'quiqqer.contact.settings.form'
            );

            formData = JSON.decode(formData);

            this.$Panel.Loader.show();

            this.$getSettings().then(function (Settings) {
                self.$Panel.Loader.hide();

                if (formData) {
                    self.$Form.load(formData);
                }

                self.$Form.setAttributes(Settings.settings);
                self.$Form.inject(self.$Elm);
            });

            this.$Panel.minimizeCategory();
            this.$Panel.getContent().setStyle('padding', 0);
        },

        /**
         * If the Panel is unloaded -> save all FormBuilder data
         */
        unload: function () {
            this.$Site.setAttribute(
                'quiqqer.contact.settings.form',
                JSON.encode(this.$Form.save())
            );
        },

        /**
         * Get quiqqer/contact settings
         *
         * @return {Promise}
         */
        $getSettings: function () {
            return new Promise(function (resolve, reject) {
                QUIAjax.get('package_quiqqer_contact_ajax_getSettings', resolve, {
                    'package': 'quiqqer/contact',
                    onError  : reject
                });
            });
        },

        /**
         * event : on destroy
         * set the tags to the site
         */
        $onDestroy: function () {
            this.$Panel.maximizeCategory();
            this.$Panel.getContent().setStyle('padding', null);

            this.unload();
        }
    });
});
