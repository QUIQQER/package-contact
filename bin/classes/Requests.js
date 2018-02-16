/**
 * Contact Requests Handler
 *
 * @module package/quiqqer/contact/bin/classes/Requests
 * @author www.pcsg.de (Patrick Müller)
 *
 * @require Ajax
 */
define('package/quiqqer/contact/bin/classes/Requests', [

    'Ajax'

], function (QUIAjax) {
    "use strict";

    var pkg = 'quiqqer/contact';

    return new Class({

        Type: 'package/quiqqer/contact/bin/classes/Requests',

        /**
         * Get list of all Requests
         *
         * @param {Object} SearchParams
         * @return {Promise}
         */
        getList: function (SearchParams) {
            return new Promise(function (resolve, reject) {
                QUIAjax.get('package_quiqqer_contact_ajax_requests_getList', resolve, {
                    'package'   : pkg,
                    searchParams: JSON.encode(SearchParams),
                    onError     : reject
                });
            });
        },

        /**
         * Get list of all request forms
         *
         * @return {Promise}
         */
        getForms: function () {
            return new Promise(function (resolve, reject) {
                QUIAjax.get('package_quiqqer_contact_ajax_requests_getForms', resolve, {
                    'package': pkg,
                    onError  : reject
                });
            });
        }
    });
});
