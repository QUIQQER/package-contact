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

    'controls/grid/Grid',

    'package/quiqqer/contact/bin/Requests',

    'Locale',
    'Mustache',

    'text!package/quiqqer/contact/bin/controls/backend/RequestList.html',
    'css!package/quiqqer/contact/bin/controls/backend/RequestList.css'

], function (QUIPanel, QUILoader, QUISelect, Grid, Requests, QUILocale, Mustache, template) {
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
            '$toggleActiveStatus',
            '$managePackages',
            '$delete',
            '$editBundle',
            'refresh',
            '$openUserPanel',
            '$sendMail'
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

            var FormSelect = new QUISelect({
                placeholderText      : QUILocale.get(lg, 'controls.backend.RequestList.formselect_placeholder'),
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

            this.Loader.show();

            Requests.getForms().then(function (forms) {
                self.Loader.hide();

                for (var i = 0, len = forms.length; i < len; i++) {
                    var Form = forms[i];

                    FormSelect.appendChild(
                        Form.title,
                        Form.id
                    );

                    self.$Forms[Form.id] = JSON.decode(Form.dataFields);
                }

                console.log(self.$Forms);
            });

            //this.$load();
        },

        /**
         * Refresh data
         */
        refresh: function () {
            if (this.$Grid) {
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

            var columns = [{
                header   : QUILocale.get(lg, 'controls.RequestList.tbl.header.submitDate'),
                dataIndex: 'submitDate',
                dataType : 'string',
                width    : 150
            }];

            var formFields = this.$Forms[id];

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
                serverSort       : true,
                selectable       : true,
                multipleSelection: true
            });

            this.$Grid.addEvents({
                onDblClick: function () {
                    // @todo
                    //self.$managePackages(
                    //    self.$Grid.getSelectedData()[0].id
                    //);
                },
                onClick   : function (event) {
                    //var selected = self.$Grid.getSelectedData();
                    //
                    //self.getButtons('delete').enable();
                    //self.getButtons('sendmail').enable();
                    //
                    //if (!event.cell.hasClass('clickable')) {
                    //    return;
                    //}
                    //
                    //var Row = selected[0];
                    //
                    //if (Row.userId) {
                    //    self.Loader.show();
                    //
                    //    self.$openUserPanel(Row.userId).then(function () {
                    //        self.Loader.hide();
                    //    });
                    //}
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
            var textUnused       = QUILocale.get(lg, 'controls.RequestList.tbl.status.unused');
            var textUnlimited    = QUILocale.get(lg, 'controls.RequestList.tbl.validUntil.unlimited');
            var textInvalid      = QUILocale.get(lg, 'controls.RequestList.tbl.status.invalid');
            var textUserNotExist = QUILocale.get(lg, 'controls.RequestList.tbl.user.not_exist');

            //for (var i = 0, len = GridData.data.length; i < len; i++) {
            //}

            this.$Grid.setData(GridData);
        }
    });
});
