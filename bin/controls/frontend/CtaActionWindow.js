define('package/quiqqer/contact/bin/controls/frontend/CtaActionWindow', [

    'qui/QUI',
    'qui/controls/windows/SimpleWindow',
    'Ajax',
    'package/quiqqer/bricks/bin/Controls/WindowContentReveal',

    'css!package/quiqqer/contact/bin/controls/frontend/CtaActionWindow.css'

], function (QUI, SimpleWindow, QUIAjax, WindowContentReveal) {
    "use strict";

    return new Class({

        Type: 'package/quiqqer/contact/bin/controls/frontend/CtaActionWindow',
        Extends: SimpleWindow,

        Binds: [
            '$onOpen',
            '$onCreate'
        ],

        options: {
            maxHeight: 800,
            maxWidth: 1200,
            backgroundClosable: false,
            resizable: false,

            'data-brickid': '',
            header: '',
            content: '',
            title: '',
            description: '',

            name_label: '',
            name_placeholder: '',
            company_label: '',
            company_placeholder: '',
            email_label: '',
            email_placeholder: '',
            phone_label: '',
            phone_placeholder: '',
            message_label: '',
            message_placeholder: '',
            submit_label: '',

            // views
            startView: 'form', // form, select, ai
            aiBrickId: '',     // brick rendered in the ai view
            aiContext: '',     // fallback context, overruled by brickParams
            aiSidebar: false,
            formEnabled: true,
            formSidebar: false,
            formSidebarAi: false,
            contactDisplay: 'icon-text',

            // parameters handed to the CtaAction brick and, from there, to
            // the ai agent brick, e.g. {context: 'Package: Starter'}. Only
            // effective together with data-brickid, because they are applied
            // by the brick render.
            brickParams: false,

            // buttons
            btnStyle: 'button', // button, rounded
            size: 'default',
            whatsapp: '',
            whatsappLabel: '',
            phone: '',
            phoneLabel: '',
            email: '',
            emailLabel: '',
            customButtons: '',
            secondaryActionsLabel: '',
            aiButtonText: '',
            aiButtonIcon: '',
            formButtonText: '',
            formButtonIcon: '',

            // design
            formDesign: 'default', // default, grid, labelLeft
            bgColor: '',
            color: '',
            leftBgColor: '',
            leftColor: '',
        },

        initialize: function (options) {
            this.parent(options);
            this.$ctaAction = null;
            this.$contentPromise = null;

            this.addEvents({
                onOpen: this.$onOpen,
                onCreate: this.$onCreate
            });
        },

        open: function (callback) {
            return WindowContentReveal.prepare(this, () => this.$loadContent()).then(() => {
                return SimpleWindow.prototype.open.call(this, callback);
            }).catch((error) => {
                console.error(error);
                this.destroy();
                throw error;
            });
        },

        $onCreate: function() {
            this.getElm().classList.add('qui-window-popup--ctaActionWindow');
        },

        $onOpen: function () {
            if (this.$contentPromise) {
                return;
            }

            this.$loadContent().catch((error) => {
                console.error(error);
                this.close();
            });
        },

        $loadContent: function () {
            if (this.$contentPromise) {
                return this.$contentPromise;
            }

            this.$contentPromise = new Promise((resolve, reject) => {
                this.getContent().classList.add('qui-contact-controls-ctaActionWindow');
                this.getContent().innerHTML = '';
                this.getContent().innerHTML = this.$getSkeletonHtml();

                let SkeletonLoader = this.getContent().querySelector('[data-name="skeletonLoader"]');
                let ControlContainer = document.createElement('div');
                ControlContainer.classList.add('qui-contact-controls-ctaActionWindow__controlContainer');
                ControlContainer.style.opacity = '0';
                this.getContent().appendChild(ControlContainer);

                // Prevent flashing of the SkeletonLoader
                // If the CtaAction control is quickly loaded,
                // it is not necessary to show the SkeletonLoader for a short period of time.
                // Show the SkeletonLoader after 250ms, because the Control may take longer to load.
                setTimeout(() => {
                    if (SkeletonLoader && SkeletonLoader.isConnected) {
                        SkeletonLoader.style.opacity = '1';
                    }
                }, 250);

                const revealControl = () => {
                    ControlContainer.style.opacity = '1';

                    if (SkeletonLoader && SkeletonLoader.isConnected) {
                        SkeletonLoader.remove();
                    }
                    resolve();
                };

                // The ai view fills its host asynchronously and, because the ajax
                // render carries data-qui, the ai control is mounted by whichever
                // (possibly re-parsed) CtaAction instance wins the DOM guard - not
                // necessarily this.$ctaAction. So the mount is signalled by a
                // bubbling DOM event instead of an instance event; the skeleton then
                // hands over to the ai control's own skeleton without a gap.
                this.getContent().addEventListener(
                    'quiqqer-contact-ctaAction-aiMounted', revealControl, {once: true}
                );

                require(['package/quiqqer/contact/bin/controls/frontend/CtaAction'], (CtaAction) => {
                    this.$ctaAction = new CtaAction(this.getAttributes());

                    this.getCtaAction().addEvents({
                        onLoadError: reject,
                        onLoad: () => {
                            this.fireEvent('load', [this, this.getCtaAction()]);

                            // Reveal now unless we still wait for an ai control to
                            // mount into an (as yet empty) ai host. Read the actually
                            // rendered view so a server-side downgrade (ai -> form)
                            // cannot leave the skeleton hanging.
                            const layout = ControlContainer.querySelector('[data-name="layout"]');
                            const aiHost = ControlContainer.querySelector('[data-name="aiHost"]');
                            const aiPending = layout
                                && layout.getAttribute('data-active-view') === 'ai'
                                && aiHost
                                && aiHost.children.length === 0;

                            if (!aiPending) {
                                revealControl();
                            }
                        },
                        onSendBegin: () => {
                            this.Loader.show();
                        },
                        onSendEnd: () => {
                            this.Loader.hide();
                        }
                    });

                    this.getCtaAction().inject(ControlContainer);
                }, reject);
            });

            return this.$contentPromise;
        },

        getCtaAction: function () {
            return this.$ctaAction;
        },

        send: function () {
            if (!this.getCtaAction()) {
                return;
            }

            this.Loader.show();

            this.getCtaAction().send().then(() => {
                this.close();
            }).catch(() => {
                this.Loader.hide();
            });
        },

        /**
         * Get the skeleton HTML for the configured start view.
         *
         * The skeleton mirrors the layout the real control will show, so a slow
         * load does not flash a different structure than the final view. The
         * sidebar only appears when the target view actually shows it: form
         * with formSidebar, ai with aiSidebar, select never. This matches the
         * [data-active-view] rules in the control's Control.css.
         *
         * @return {string} The skeleton HTML.
         */
        $getSkeletonHtml: function () {
            // Saved brick settings are resolved by the server. Until then a
            // neutral loader avoids promising the wrong view or sidebar.
            if (Number(this.getAttribute('data-brickid')) > 0) {
                return '<div class="qui-contact-controls-ctaActionWindow__skeletonLoader"'
                    + ' data-name="skeletonLoader" aria-hidden="true">' + this.$getAiSkeletonHtml() + '</div>';
            }

            const enabled = (name) => [true, 1, '1'].includes(this.getAttribute(name));
            let startView = this.getAttribute('startView');

            if (!['form', 'select', 'ai'].includes(startView)
                || (startView === 'form' && !enabled('formEnabled'))
                || (startView === 'ai' && !(Number(this.getAttribute('aiBrickId')) > 0))) {
                startView = 'select';
            }

            const showSidebar = (startView === 'form' && enabled('formSidebar'))
                || (startView === 'ai' && this.$isAiSidebar());

            let rightContent;

            if (startView === 'select') {
                rightContent = this.$getSelectSkeletonHtml();
            } else if (startView === 'ai') {
                rightContent = this.$getAiSkeletonHtml();
            } else {
                rightContent = this.$getFormSkeletonHtml(['grid', 'labelLeft'].includes(this.getAttribute('formDesign'))
                    ? this.getAttribute('formDesign') : 'default');
            }

            return `
<div class="qui-contact-controls-ctaActionWindow__skeletonLoader" data-name="skeletonLoader" style="opacity: 0;" aria-hidden="true">
    <div class="quiqqer-contact-ctaAction">
        ${showSidebar ? this.$getSidebarSkeletonHtml() : ''}
        <section class="quiqqer-contact-ctaAction__rightContent">
            ${rightContent}
        </section>
    </div>
</div>
            `;
        },

        /**
         * @return {boolean} whether the ai view shows the sidebar
         */
        $isAiSidebar: function () {
            const value = this.getAttribute('aiSidebar');

            return value === true || value === 1 || value === '1';
        },

        /**
         * @return {string} sidebar (left content) skeleton
         */
        $getSidebarSkeletonHtml: function () {
            return `
<aside class="quiqqer-contact-ctaAction__leftContent">
    <div class="default-content">
        <span class="skeleton-loader skeleton-loader-header" style="width: 60%;"></span>
        <span class="skeleton-loader skeleton-loader-text" style="width: 100%;"></span>
        <span class="skeleton-loader skeleton-loader-text" style="width: 90%;"></span>
        <span class="skeleton-loader skeleton-loader-text" style="width: 100%;"></span>
        <span class="skeleton-loader skeleton-loader-text" style="width: 80%;"></span>
    </div>
</aside>`;
        },

        /**
         * @param {string} formDesign - default, grid, labelLeft
         * @return {string} form view skeleton (inner right content)
         */
        $getFormSkeletonHtml: function (formDesign) {
            return `
<span class="skeleton-loader skeleton-loader-header" style="width: 40%;"></span>
<span class="skeleton-loader skeleton-loader-text" style="width: 90%;"></span>
<span class="skeleton-loader skeleton-loader-text" style="width: 50%; margin-bottom: 2rem;"></span>

<form class="quiqqer-contact-ctaAction__form form form--${formDesign} quiqqer-contact-ctaAction__form--dummy-content">
    <div class="form-field form-field--name">
        <div class="form-label">
            <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 4rem;"></span>
        </div>
        <div class="form-control">
            <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></div>
        </div>
    </div>
    <div class="form-field form-field--company">
        <div class="form-label">
            <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 5rem;"></span>
        </div>
        <div class="form-control">
            <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></div>
        </div>
    </div>
    <div class="form-field form-field--email">
        <div class="form-label">
            <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 3rem;"></span>
        </div>
        <div class="form-control">
            <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></div>
        </div>
    </div>
    <div class="form-field form-field--phone">
        <div class="form-label">
            <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 6rem;"></span>
        </div>
        <div class="form-control">
            <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></div>
        </div>
    </div>
    <div class="form-field form-field--message">
        <div class="form-label">
            <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 8rem;"></span>
        </div>
        <div class="form-control">
            <div class="skeleton-loader skeleton-loader-text" style="height: 7rem;"></div>
        </div>
    </div>
    <div class="form-field form-field--privacy">
        <label class="check">
            <div style="display: flex; gap: 1ch; margin-bottom: 0.5em;">
                <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm" style="width: 1.5rem;"></div>
                <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm"></div>
            </div>
            <div class="skeleton-loader skeleton-loader-text skeleton-loader-text--sm"></div>
        </label>
    </div>
    <div class="form-actions">
        <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg" style="width: min(15rem, 100%);"></span>
    </div>
</form>`;
        },

        /**
         * @return {string} select view skeleton (inner right content):
         *     centered heading, teaser lines and two choice buttons
         */
        $getSelectSkeletonHtml: function () {
            return `
<div class="quiqqer-contact-ctaAction__skeleton-select">
    <span class="skeleton-loader skeleton-loader-header" style="width: 60%;"></span>
    <span class="skeleton-loader skeleton-loader-text" style="width: 85%;"></span>
    <span class="skeleton-loader skeleton-loader-text" style="width: 70%;"></span>
    <div class="quiqqer-contact-ctaAction__skeleton-choices">
        <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></span>
        <span class="skeleton-loader skeleton-loader-text skeleton-loader-text--lg"></span>
    </div>
</div>`;
        },

        /**
         * @return {string} ai view loader (inner right content): a neutral,
         *     centered spinner. The ai view is filled by the configured agent
         *     brick, which ships its own skeleton once rendered, so this
         *     deliberately does not mimic any specific brick's layout; it only
         *     bridges the load until the brick takes over (see the aiMounted
         *     handover in $onOpen).
         */
        $getAiSkeletonHtml: function () {
            return `
<div class="quiqqer-contact-ctaAction__skeleton-ai">
    <span class="quiqqer-contact-ctaAction__skeleton-ai-spinner fa fa-circle-o-notch fa-spin" aria-hidden="true"></span>
</div>`;
        }
    });
});
