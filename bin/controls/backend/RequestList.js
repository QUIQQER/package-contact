/**
 * View/Export contact requests
 *
 * @module package/quiqqer/contact/bin/controls/backend/RequestList
 * @author www.pcsg.de (Patrick Müller)
 */
define('package/quiqqer/contact/bin/controls/backend/RequestList', [

    'qui/controls/desktop/Panel',
    'qui/controls/loader/Loader',
    'qui/controls/buttons/Select',
    'qui/controls/buttons/Button',
    'qui/controls/buttons/Separator',
    'qui/controls/windows/Confirm',

    'controls/grid/Grid',

    'package/quiqqer/contact/bin/Requests',

    'Locale',
    'Mustache',

    'text!package/quiqqer/contact/bin/controls/backend/RequestList.html',
    'css!package/quiqqer/contact/bin/controls/backend/RequestList.css'

], function (QUIPanel, QUILoader, QUISelect, QUIButton, QUISeparator, QUIConfirm, Grid, Requests,
             QUILocale, Mustache, template) {
    "use strict";

    var lg = 'quiqqer/contact';

    return new Class({

        Extends: QUIPanel,
        Type   : 'package/quiqqer/contact/bin/controls/backend/RequestList',

        Binds: [
            '$onCreate',
            '$onResize',
            '$listRefresh',
            '$onRefresh',
            '$load',
            '$setGridData',
            '$create',
            'refresh',
            '$showRequestDetails',
            '$deleteRequests'
        ],

        options: {
            title: QUILocale.get(lg, 'controls.RequestList.title')
        },

        initialize: function (options) {
            this.parent(options);

            this.Loader         = new QUILoader();
            this.$User          = null;
            this.$Grid          = null;
            this.$GridParent    = null;
            this.$Panel         = null;
            this.$Forms         = {};
            this.$currentFormId = false;
            this.$ViewBtn       = null;
            this.$DeleteBtn     = null;

            this.addEvents({
                onCreate : this.$onCreate,
                onRefresh: this.$onRefresh,
                onResize : this.$onResize
            });
        },

        /**
         * Event: onCreate
         */
        $onCreate: function () {
            var self = this;

            this.Loader.inject(this.$Elm);
            this.$Elm.addClass('quiqqer-contact-requestlist');

            var FormSelect = new QUISelect({
                'class'              : 'form-select',
                placeholderText      : QUILocale.get(lg, 'controls.RequestList.formselect_placeholder'),
                placeholderIcon      : false,
                placeholderSelectable: false, // placeholder is standard selectable menu child
                showIcons            : false,
                events               : {
                    onChange: function (value) {
                        self.$buildFormTable(value);
                    }
                }
            });

            this.addButton(FormSelect);

            this.addButton(new QUISeparator());

            this.$ViewBtn = new QUIButton({
                disabled : true,
                text     : QUILocale.get(lg, 'controls.RequestList.btn.view_request'),
                textimage: 'fa fa-eye',
                events   : {
                    onClick: function () {
                        self.$showRequestDetails(self.$Grid.getSelectedData()[0]);
                    }
                }
            });

            this.addButton(this.$ViewBtn);

            this.$DeleteBtn = new QUIButton({
                disabled : true,
                text     : QUILocale.get(lg, 'controls.RequestList.btn.delete_requests'),
                textimage: 'fa fa-trash',
                events   : {
                    onClick: this.$deleteRequests
                }
            });

            this.addButton(this.$DeleteBtn);

            this.Loader.show();

            Requests.getForms().then(function (forms) {
                self.Loader.hide();

                for (var i = 0, len = forms.length; i < len; i++) {
                    var Form = forms[i];

                    FormSelect.appendChild(
                        Form.title,
                        Form.id
                    );

                    self.$Forms[Form.id] = {
                        fields: JSON.decode(Form.dataFields),
                        title : Form.title
                    };
                }

                var infoText = QUILocale.get(lg, 'controls.RequestList.select_info');

                if (!forms.length) {
                    infoText = QUILocale.get(lg, 'controls.RequestList.no_forms_info');
                    FormSelect.disable();
                }

                self.setContent('<div class="form-select-info">' + infoText + '</div>');
            });
        },

        /**
         * Refresh data
         */
        refresh: function () {
            if (this.$Grid) {
                this.$ViewBtn.disable();
                this.$DeleteBtn.disable();
                this.$Grid.refresh();
            }
        },

        /**
         * event: onResize
         */
        $onResize: function () {
            if (this.$GridParent && this.$Grid) {
                var size = this.$GridParent.getSize();

                this.$Grid.setHeight(size.y);
                this.$Grid.resize();
            }
        },

        /**
         * Load Grid for contact form
         *
         * @param {String} id - Special form id
         */
        $buildFormTable: function (id) {
            var self = this;

            this.$ViewBtn.disable();
            this.$DeleteBtn.disable();

            var columns = [{
                header   : QUILocale.get('quiqqer/system', 'id'),
                dataIndex: 'id',
                dataType : 'number',
                width    : 75,
            }, {
                header   : QUILocale.get(lg, 'controls.RequestList.tbl.header.submitDate'),
                dataIndex: 'submitDate',
                dataType : 'string',
                width    : 200
            }, {
                dataIndex: 'formId',
                dataType : 'number',
                hidden   : true
            }];

            var formFields = this.$Forms[id].fields;

            for (var i = 0, len = formFields.length; i < len; i++) {
                var Field = formFields[i];

                columns.push({
                    header   : Field.label,
                    dataIndex: Field.name,
                    dataType : 'string',
                    width    : 150
                });
            }

            this.setContent(Mustache.render(template));
            var Content = this.getContent();

            this.$GridParent = Content.getElement(
                '.quiqqer-contact-requestlist-table'
            );

            this.$Grid = new Grid(this.$GridParent, {
                columnModel      : columns,
                pagination       : true,
                serverSort       : false,
                selectable       : true,
                multipleSelection: true,
                exportData       : true,
                exportTypes      : {
                    pdf : 'PDF',
                    csv : 'CSV',
                    json: 'JSON'
                }
            });

            this.$Grid.addEvents({
                onDblClick: function () {
                    self.$showRequestDetails(self.$Grid.getSelectedData()[0]);
                },
                onClick   : function () {
                    var selected = self.$Grid.getSelectedData();

                    if (selected.length === 1) {
                        self.$ViewBtn.enable();
                    } else {
                        self.$ViewBtn.disable();
                    }

                    self.$DeleteBtn.enable();
                },
                onRefresh : this.$listRefresh
            });

            this.$currentFormId = id;

            this.resize();
            this.$Grid.refresh();
        },

        /**
         * Event: onRefresh
         */
        $onRefresh: function () {
            if (this.$Grid) {
                this.$Grid.refresh();
            }
        },

        /**
         * Refresh bundle list
         *
         * @param {Object} Grid
         */
        $listRefresh: function (Grid) {
            if (!this.$Grid) {
                return;
            }

            var self = this;

            var GridParams = {
                sortOn : Grid.getAttribute('sortOn'),
                sortBy : Grid.getAttribute('sortBy'),
                perPage: Grid.getAttribute('perPage'),
                page   : Grid.getAttribute('page'),
                id     : this.$currentFormId
            };

            this.Loader.show();

            Requests.getList(GridParams).then(function (ResultData) {
                self.Loader.hide();
                self.$setGridData(ResultData);
            });
        },

        /**
         * Set license data to grid
         *
         * @param {Object} GridData
         */
        $setGridData: function (GridData) {
            this.$Grid.setData(GridData);
        },

        /**
         * Show details of a specific form request in a Popup
         *
         * @param {Object} RequestData - The request data
         */
        $showRequestDetails: function (RequestData) {
            var Form = this.$Forms[RequestData.formId];

            var Popup = new QUIConfirm({
                maxHeight: 800,

                title: Form.title + ' - ' + RequestData.submitDate,
                icon : 'fa fa-list-alt',

                cancel_button: false,
                ok_button    : {
                    text     : 'OK',
                    textimage: 'icon-ok fa fa-check'
                },
                events       : {
                    onOpen: function () {
                        var Content = Popup.getContent();

                        Content.set('html', '');

                        var List = new Element('ul').inject(Content);

                        for (var i = 0, len = Form.fields.length; i < len; i++) {
                            new Element('li', {
                                'class': 'quiqqer-contact-requestlist-request-field',
                                html   : '<span>' + Form.fields[i].label + '</span>' +
                                '<p>' + RequestData[Form.fields[i].name] + '</p>'
                            }).inject(List);
                        }
                    }
                }

            });

            Popup.open();
        },

        /**
         * Delete contact requests of the selected rows
         */
        $deleteRequests: function () {
            var self      = this;
            var deleteIds = [];
            var rows      = this.$Grid.getSelectedData();
            var Form      = this.$Forms[this.$currentFormId];

            for (var i = 0, len = rows.length; i < len; i++) {
                deleteIds.push(rows[i].id);
            }

            // open popup
            var Popup = new QUIConfirm({
                maxHeight: 300,
                autoclose: false,

                information: QUILocale.get(lg,
                    'controls.RequestList.delete.info', {
                        form      : Form.title,
                        requestIds: '#' + deleteIds.join(', #')
                    }
                ),
                title      : QUILocale.get(lg, 'controls.RequestList.delete.title'),
                texticon   : 'fa fa-trash',
                text       : QUILocale.get(lg, 'controls.RequestList.delete.title'),
                icon       : 'fa fa-trash',

                cancel_button: {
                    text     : false,
                    textimage: 'icon-remove fa fa-remove'
                },
                ok_button    : {
                    text     : false,
                    textimage: 'icon-ok fa fa-check'
                },
                events       : {
                    onSubmit: function () {
                        Popup.Loader.show();

                        Requests.deleteRequests(deleteIds).then(function (success) {
                            if (!success) {
                                Popup.Loader.hide();
                                return;
                            }

                            Popup.close();
                            self.refresh();
                        });
                    }
                }
            });

            Popup.open();
        }
    });
});
