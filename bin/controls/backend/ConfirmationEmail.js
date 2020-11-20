/**
 * Contact form confirmation e-mail editor
 *
 * @module package/quiqqer/contact/bin/controls/backend/ConfirmationEmail
 * @author www.pcsg.de (Patrick Müller)
 */
define('package/quiqqer/contact/bin/controls/backend/ConfirmationEmail', [

    'qui/controls/Control',
    'package/quiqqer/formbuilder/bin/FormBuilder',

    'Ajax',
    'Locale',
    'Mustache',
    'Editors',

    'text!package/quiqqer/contact/bin/controls/backend/ConfirmationEmail.html',
    'css!package/quiqqer/contact/bin/controls/backend/ConfirmationEmail.css'

], function (QUIControl, FormBuilder, QUIAjax, QUILocale, Mustache, Editors, template) {
    "use strict";

    var lg = 'quiqqer/contact';

    return new Class({

        Extends: QUIControl,
        Type   : 'package/quiqqer/contact/bin/controls/backend/ConfirmationEmail',

        Binds: [
            '$onInject',
            '$onDestroy',
            '$getFields',
            '$onPlaceholderClick',
            '$save',
            '$clearEditorPeriodicalSave',
            '$startEditorPeriodicalSave'
        ],

        options: {
            Site: false
        },

        initialize: function (options) {
            this.parent(options);

            this.$Panel              = this.getAttribute('Panel');
            this.$Site               = this.getAttribute('Site');
            this.$Project            = this.$Site.getProject();
            this.$Form               = new FormBuilder();
            this.$Editor             = null;
            this.$EditorInstance     = null;
            this.$editorSaveInterval = null;
            this.$SendMailCheckbox   = null;
            this.$MailSubjectInput   = null;

            //this.$Panel.addEvent('onCategoryLeave', this.$onDestroy);

            this.addEvents({
                onInject : this.$onInject,
                onDestroy: this.$onDestroy,
                onResize : this.$onResize
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
            var MailData = this.$Site.getAttribute('quiqqer.contact.success_mail');

            if (MailData) {
                try {
                    MailData = JSON.decode(MailData);
                } catch(e) {
                    MailData = false;
                }
            }

            this.$Panel.Loader.show();

            this.$getFields().then(function (fields) {
                self.$Elm.set('html', Mustache.render(template, {
                    fields            : fields,
                    labelLabel        : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.labelLabel'),
                    labelValue        : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.labelValue'),
                    headerPlaceholders: QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.headerPlaceholders'),
                    headerSettings    : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.headerSettings'),
                    headerBody        : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.headerBody'),
                    labelSendMail     : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.labelSendMail'),
                    labelSubject      : QUILocale.get(lg, 'controls.ConfirmationEmail.tpl.labelSubject')
                }));

                self.$SendMailCheckbox = self.$Elm.getElement('input[name="send_mail"]');
                self.$MailSubjectInput = self.$Elm.getElement('input[name="mail_subject"]');

                self.$SendMailCheckbox.addEvent('change', self.$save);
                self.$MailSubjectInput.addEvent('change', self.$save);

                if (MailData) {
                    self.$SendMailCheckbox.checked = MailData.send;
                    self.$MailSubjectInput.value   = MailData.subject;
                }

                Editors.getEditor().then(function (Editor) {
                    self.$Editor = Editor;

                    Editor.addEvent('onLoaded', function () {
                        self.$EditorInstance = Editor.getInstance();
                        self.$clearEditorPeriodicalSave();
                        self.$startEditorPeriodicalSave();

                        self.$Panel.Loader.hide();
                        self.fireEvent('load', [self]);
                        self.$onResize();
                    });

                    Editor.inject(self.$Elm.getElement('.quiqqer-contact-confirmationemail-content'));
                    Editor.setContent('');

                    if (MailData) {
                        Editor.setContent(MailData.body);
                    }

                    // Register click-to-insert event
                    self.$Elm.getElements(
                        '.quiqqer-contact-confirmationemail-placeholders-entry'
                    ).addEvent('click', self.$onPlaceholderClick);
                });
            });
        },

        /**
         * onResize
         */
        $onResize: function () {
            var ContentSize = this.$Panel.getContent().getSize();

            if (this.$Editor) {
                this.$Editor.setWidth(ContentSize.x - 250);
                this.$Editor.setHeight(ContentSize.y - 175);
            }
        },

        /**
         * Triggers if user clicks on a placeholder text
         *
         * @param {DocumentEvent} event
         */
        $onPlaceholderClick: function (event) {
            var placeholder = event.target.get('data-value');

            if (typeof this.$EditorInstance.insertText === 'function') {
                this.$EditorInstance.insertText(placeholder);
            }
        },

        /**
         * Clear editor content save interval
         */
        $clearEditorPeriodicalSave: function () {
            if (!this.$editorSaveInterval) {
                return;
            }

            clearInterval(this.$editorSaveInterval);
            this.$editorSaveInterval = null;
        },

        /**
         * Start editor content save interval (every 1 second)
         */
        $startEditorPeriodicalSave: function () {
            var self = this;

            this.$editorSaveInterval = setInterval(function () {
                self.$save();
            }, 500);
        },

        /**
         * Save mail content to Site
         */
        $save: function () {
            var MailData = {
                send   : this.$SendMailCheckbox.checked,
                subject: this.$MailSubjectInput.value.trim(),
                body   : this.$Editor.getContent()
            };

            this.$Site.setAttribute('quiqqer.contact.success_mail', JSON.encode(MailData));
        },

        /**
         * Get form fields
         *
         * @return {Promise}
         */
        $getFields: function () {
            var self = this;

            return new Promise(function (resolve, reject) {
                QUIAjax.get('package_quiqqer_contact_ajax_getFields', resolve, {
                    'package': 'quiqqer/contact',
                    project  : self.$Project.encode(),
                    siteId   : self.$Site.getId(),
                    onError  : reject
                });
            });
        },

        /**
         * event : on destroy
         *
         * Save mail content
         */
        $onDestroy: function () {
            this.$clearEditorPeriodicalSave();
            this.$save();
            //this.$Editor.destroy();
            //Editors.destroyEditor(this.$Editor);


            this.$Editor         = null;
            this.$EditorInstance = null;

            //this.$Panel.setContent('');
            //this.$Panel.maximizeCategory();
        }
    });
});
