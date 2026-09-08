define('package/quiqqer/contact/bin/controls/frontend/CtaAction', [

    'qui/QUI',
    'qui/controls/Control',
    'qui/controls/loader/Loader',
    'Ajax',
    'Locale'

], function (QUI, QUIControl, QUILoader, QUIAjax, QUILocale) {
    "use strict";

    const lg = 'quiqqer/contact';

    return new Class({

        Type: 'package/quiqqer/contact/bin/controls/frontend/CtaAction',
        Extends: QUIControl,

        options: {
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
            success_message: '',

            // views
            startView: 'form', // form, select, ai
            aiBrickId: '',
            aiBrickParams: '',
            aiContext: '',
            aiSidebar: false,

            // parameters handed in by whoever opened this control, e.g.
            // {context: 'Package: Starter'}. They are applied server side
            // under the "param-" prefix and passed on to the agent brick.
            brickParams: false,

            // buttons
            btnStyle: 'button', // iconRounded, icon, button
            size: 'default',
            whatsapp: false,
            whatsappLabel: false,
            phone: false,
            phoneLabel: false,
            email: false,
            emailLabel: false,
            customButtons: '',

            // design
            formDesign: 'default', // default, grid, labelLeft
            bgColor: '',
            color: '',
            leftBgColor: '',
            leftColor: '',
        },

        initialize: function (options) {
            this.parent(options);

            this.Loader = new QUILoader();
            this.$Layout = null;
            this.$aiMounted = false;

            this.addEvents({
                onImport: this.$onImport
            });
        },

        $onImport: function () {
            this.getElm().style.width = '100%';
            this.setAttribute('btnStyle', this.getElm().getAttribute('data-qui-options-btnstyle'));
            this.setAttribute('size', this.getElm().getAttribute('data-qui-options-size'));
            this.Loader.inject(this.getElm());
            this.$initEvents();
        },

        create: function () {
            const container = this.parent();

            container.innerHTML = '';
            container.style.width = '100%';

            this.$Elm = container;

            QUIAjax.get('package_quiqqer_contact_ajax_ctaAction_get', (html) => {
                container.innerHTML = html;
                this.Loader.inject(this.getElm());

                QUI.parse(container).then(() => {
                    this.$initViews();
                    this.fireEvent('load', [this]);
                });
            }, {
                'package': lg,
                attributes: JSON.stringify(this.getControlAttributes()),
                brickParams: this.$getBrickParamsJson()
            });

            return container;
        },

        $initEvents: function () {
            const form = this.getElm().querySelector('form');

            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    this.send().catch(() => {
                        // nothing, error event is triggered in send
                    });
                });
            }

            const privacyLabel = this.getElm().querySelector('[data-name="privacy"]');

            if (privacyLabel) {
                const aNode = privacyLabel.querySelector('a');

                if (aNode) {
                    aNode.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        require(['package/quiqqer/controls/bin/site/Window'], function (Win) {
                            new Win({
                                showTitle: true,
                                project: aNode.dataset.project,
                                lang: aNode.dataset.lang,
                                id: aNode.dataset.id
                            }).open();
                        });
                    });
                }
            }

            this.$initViews();
            this.fireEvent('load', [this]);
        },

        /**
         * Wire up the view switching (select / form / ai) and mount the
         * configured ai control when the ai view is active on load.
         *
         * The init guard lives on the layout element (DOM), not on the
         * instance: the ajax render returns a wrapper carrying data-qui, so
         * QUI.parse may import the control twice. The DOM guard makes sure the
         * choices are only wired and the ai control only mounted once.
         */
        $initViews: function () {
            const layout = this.getElm().querySelector('[data-name="layout"]');

            if (!layout || layout.getAttribute('data-views-init') === '1') {
                return;
            }

            layout.setAttribute('data-views-init', '1');

            this.$Layout = layout;

            const aiBrickId = layout.getAttribute('data-ai-brick-id');

            if (aiBrickId) {
                this.setAttribute('aiBrickId', aiBrickId);
            }

            const aiBrickParams = layout.getAttribute('data-ai-brick-params');

            if (aiBrickParams) {
                this.setAttribute('aiBrickParams', aiBrickParams);
            }

            this.getElm().querySelectorAll('[data-name="viewChoice"]').forEach((choice) => {
                choice.addEventListener('click', (event) => {
                    event.preventDefault();
                    this.switchView(choice.getAttribute('data-view-target'));
                });
            });

            const activeView = this.getActiveView();

            if (activeView === 'ai') {
                this.$mountAiBrick();
            }
        },

        /**
         * @return {string} the currently active view (select | form | ai)
         */
        getActiveView: function () {
            if (!this.$Layout) {
                return 'form';
            }

            return this.$Layout.getAttribute('data-active-view') || 'form';
        },

        /**
         * Switch the visible view with a soft cross-fade.
         *
         * @param {string} name - select | form | ai
         * @return {Promise}
         */
        switchView: function (name) {
            const layout = this.$Layout || this.getElm().querySelector('[data-name="layout"]');

            if (!layout) {
                return Promise.resolve();
            }

            if (['select', 'form', 'ai'].indexOf(name) === -1) {
                name = 'form';
            }

            const currentName = layout.getAttribute('data-active-view') || 'form';

            if (currentName === name) {
                return Promise.resolve();
            }

            const current = this.getElm().querySelector('[data-view="' + currentName + '"]');
            const target = this.getElm().querySelector('[data-view="' + name + '"]');

            if (!target) {
                return Promise.resolve();
            }

            const reduceMotion = window.matchMedia
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            return new Promise((resolve) => {
                const finish = () => {
                    this.$focusView(target);
                    this.fireEvent('viewChange', [this, name]);
                    resolve();
                };

                const activate = () => {
                    layout.setAttribute('data-active-view', name);

                    if (name === 'ai') {
                        this.$mountAiBrick();
                    }

                    if (reduceMotion) {
                        target.style.opacity = 1;
                        finish();
                        return;
                    }

                    target.style.opacity = 0;

                    moofx(target).animate({
                        opacity: 1
                    }, {
                        duration: 250,
                        callback: finish
                    });
                };

                if (current && !reduceMotion) {
                    moofx(current).animate({
                        opacity: 0
                    }, {
                        duration: 150,
                        callback: activate
                    });

                    return;
                }

                activate();
            });
        },

        /**
         * Move focus to the first interactive element of the given view.
         *
         * @param {HTMLElement} view
         */
        $focusView: function (view) {
            const focusable = view.querySelector(
                'input, textarea, button, a[href], [tabindex]:not([tabindex="-1"])'
            );

            if (focusable) {
                focusable.focus();
            }
        },

        /**
         * Lazily render the configured AI agent brick into the ai view.
         *
         * The view shows a brick, not a fixed control: which agent answers,
         * with which persona and knowledge, is configured in that brick. This
         * package therefore knows no agent module path - it renders whatever
         * brick was selected, through the generic bricks render ajax.
         *
         * Parameters the opener handed in (e.g. the clicked package) travel
         * along as brickParams and reach the brick as prefixed settings, so
         * they can never overwrite a real setting of the agent.
         *
         * The mount guard lives on the host element (DOM) so a doubly imported
         * control cannot render the brick twice into the same host.
         */
        $mountAiBrick: function () {
            const host = this.getElm().querySelector('[data-name="aiHost"]');

            if (!host) {
                return;
            }

            if (this.$aiMounted || host.getAttribute('data-ai-mounted') === '1') {
                this.$aiMounted = true;

                return;
            }

            const brickId = parseInt(this.getAttribute('aiBrickId'), 10);

            if (!brickId || brickId <= 0) {
                return;
            }

            this.$aiMounted = true;
            host.setAttribute('data-ai-mounted', '1');
            this.Loader.show();

            const params = {
                'package': 'quiqqer/bricks',
                brickId: brickId,
                onError: () => {
                    host.removeAttribute('data-ai-mounted');
                    this.$aiMounted = false;
                    this.Loader.hide();
                    this.$notifyAiMounted(host);
                }
            };

            const brickParams = this.getAttribute('aiBrickParams');

            if (brickParams) {
                // already a JSON string, built server side - forwarded as is;
                // the render validates it and drops what it cannot use
                params.brickParams = brickParams;
            }

            QUIAjax.get('package_quiqqer_bricks_ajax_brick_render', (html) => {
                host.innerHTML = html;

                QUI.parse(host).then(() => {
                    this.Loader.hide();
                    this.$notifyAiMounted(host);
                });
            }, params);
        },

        /**
         * Signal that the ai control finished mounting (or failed) via a
         * bubbling DOM event on the ai host.
         *
         * The ajax render carries data-qui, so QUI.parse may create a second
         * CtaAction instance; the ai control is mounted by whichever instance
         * wins the DOM guard, not necessarily the one a caller (e.g.
         * CtaActionWindow) holds a reference to. A DOM event reaches listeners
         * regardless of which instance did the mount.
         *
         * @param {HTMLElement} host - the ai host element
         */
        $notifyAiMounted: function (host) {
            host.dispatchEvent(new CustomEvent('quiqqer-contact-ctaAction-aiMounted', {
                bubbles: true
            }));
        },

        send: function () {
            this.fireEvent('sendBegin');
            this.Loader.show();

            const form = this.getElm().querySelector('form') || document.createElement('form');
            const formData = new FormData(form);

            return new Promise((resolve, reject) => {
                this.getSuccessHtml().then(/** @param {string} successHtml */(successHtml) => {
                    QUIAjax.post('package_quiqqer_contact_ajax_ctaAction_send', () => {
                        // finish mess
                        const success = document.createElement('div');
                        success.classList.add('quiqqer-contact-ctaAction__success');

                        success.innerHTML = successHtml;

                        const nodes = Array.from(
                            this.getElm().querySelectorAll(
                                '[data-name="left"],[data-name="right"]'
                            )
                        );

                        moofx(nodes).animate({
                            opacity: 0
                        }, {
                            callback: () => {
                                nodes.forEach((node) => {
                                    node.parentNode.removeChild(node);
                                });

                                this.getElm().classList.add('quiqqer-contact-ctaAction--success');
                                this.getElm().appendChild(success);

                                this.fireEvent('sendEnd', [this]);
                                this.fireEvent('send', [this]);
                                this.Loader.hide();
                                resolve();
                            }
                        });
                    }, {
                        'package': 'quiqqer/contact',
                        attributes: JSON.stringify(this.getControlAttributes()),
                        formData: JSON.stringify(Object.fromEntries(formData.entries())),
                        onError: () => {
                            this.fireEvent('sendError', [this]);
                            this.Loader.hide();
                            reject();
                        }
                    });
                });
            });
        },

        addButton: function (buttonData) {
            const button = this.$normalizeButtonConfig(buttonData);
            const displayMode = this.$getDisplayMode();

            if (
                button.isDisabled ||
                (
                    (displayMode === 'icon-only' || displayMode === 'icon-only-rounded') &&
                    !button.icon
                )
            ) {
                return null;
            }

            const container = this.$getButtonsContainer();

            if (!container) {
                return null;
            }

            const element = this.$createButtonElement(button);
            container.appendChild(element);

            if (element.getAttribute('data-qui')) {
                QUI.parse(element);
            }

            return element;
        },

        $getButtonsContainer: function () {
            const btnStyle = this.$getBtnStyle();
            let buttons = this.getElm().querySelector('[data-name="buttons"]');

            if (!buttons) {
                const leftContent = this.getElm().querySelector('[data-name="left"]');

                if (!leftContent) {
                    return null;
                }

                buttons = document.createElement('div');
                buttons.setAttribute('data-name', 'buttons');
                buttons.classList.add('quiqqer-contact-ctaAction-buttons');
                leftContent.appendChild(buttons);
            }

            buttons.classList.remove(
                'quiqqer-contact-ctaAction-buttons--icon',
                'quiqqer-contact-ctaAction-buttons--iconRounded',
                'quiqqer-contact-ctaAction-buttons--button'
            );
            buttons.classList.add(`quiqqer-contact-ctaAction-buttons--${btnStyle}`);

            return buttons;
        },

        $createButtonElement: function (button) {
            const displayMode = this.$getDisplayMode();
            const isIconOnly = displayMode === 'icon-only' || displayMode === 'icon-only-rounded';
            const hasOpenBrick = button.openBrickId > 0;
            const tagName = hasOpenBrick || !button.href ? 'button' : 'a';
            const Button = document.createElement(tagName);
            const title = button.title || button.text || '';
            const ariaLabel = button.ariaLabel || button.text || '';

            Button.className = this.$getButtonClassName(button, displayMode);

            if (button.identifier) {
                Button.setAttribute('data-identifier', button.identifier);
            }

            if (title) {
                Button.setAttribute('title', title);
            }

            if (ariaLabel) {
                Button.setAttribute('aria-label', ariaLabel);
            }

            if (hasOpenBrick) {
                Button.setAttribute('type', 'button');
                Button.setAttribute(
                    'data-qui',
                    'package/quiqqer/components/bin/Controls/Button/OpenBrick'
                );
                Button.setAttribute('data-open-brick-id', String(button.openBrickId));

                if (button.openBrickWinWidth > 0) {
                    Button.setAttribute('data-win-width', String(button.openBrickWinWidth));
                }

                if (button.openBrickWinHeight > 0) {
                    Button.setAttribute('data-win-height', String(button.openBrickWinHeight));
                }
            } else if (tagName === 'a') {
                Button.setAttribute('href', button.href);

                if (button.targetBlank) {
                    Button.setAttribute('target', '_blank');
                    Button.setAttribute('rel', 'noopener noreferrer');
                }
            } else {
                Button.setAttribute('type', 'button');
            }

            if (button.disabled) {
                Button.setAttribute('aria-disabled', 'true');

                if (tagName === 'button' || hasOpenBrick) {
                    Button.setAttribute('disabled', 'disabled');
                } else {
                    Button.setAttribute('tabindex', '-1');
                }
            }

            if (button.onClick) {
                Button.setAttribute('onclick', button.onClick);
            }

            if (button.icon && button.iconPosition === 'start') {
                Button.appendChild(this.$createButtonIcon(button.icon));
            }

            if (!isIconOnly && button.text) {
                const TextNode = document.createElement('span');
                TextNode.className = 'btn__text';
                TextNode.textContent = button.text;
                Button.appendChild(TextNode);
            }

            if (button.icon && button.iconPosition === 'end') {
                Button.appendChild(this.$createButtonIcon(button.icon));
            }

            return Button;
        },

        $createButtonIcon: function (iconClass) {
            const Icon = document.createElement('span');
            Icon.className = `btn__icon ${iconClass}`.trim();
            Icon.setAttribute('aria-hidden', 'true');

            return Icon;
        },

        $getButtonClassName: function (button, displayMode) {
            const classNames = ['btn'];

            if (button.btnType) {
                classNames.push(`btn-${button.btnType}`);
            }

            if (button.size === 'sm') {
                classNames.push('btn-sm');
            }

            if (button.size === 'lg') {
                classNames.push('btn-lg');
            }

            if (button.customClass) {
                classNames.push(button.customClass);
            }

            if (displayMode === 'icon-only' || displayMode === 'icon-only-rounded') {
                classNames.push('btn-icon');
            }

            if (displayMode === 'icon-only-rounded') {
                classNames.push('btn-rounded');
            }

            if (button.fullWidth) {
                classNames.push('btn-full');
            }

            if (button.disabled) {
                classNames.push('disabled');
            }

            return classNames.join(' ');
        },

        $normalizeButtonConfig: function (buttonData) {
            buttonData = typeOf(buttonData) === 'object' ? buttonData : {};

            const text = (buttonData.text || '').toString().trim();
            const title = (buttonData.title || text).toString().trim();
            const ariaLabel = (buttonData.ariaLabel || text).toString().trim();

            return {
                text: text,
                identifier: (buttonData.identifier || '').toString().replace(/[^A-Za-z0-9_-]/g, ''),
                icon: this.$sanitizeClassList(
                    (buttonData.icon || buttonData.iconClass || '').toString()
                ),
                iconPosition: buttonData.iconPosition === 'end' ? 'end' : 'start',
                btnType: this.$normalizeButtonType(buttonData.btnType),
                size: this.$normalizeButtonSize(buttonData.size || this.getAttribute('size')),
                openBrickId: this.$normalizeDimension(buttonData.openBrickId),
                openBrickWinWidth: this.$normalizeDimension(buttonData.openBrickWinWidth),
                openBrickWinHeight: this.$normalizeDimension(buttonData.openBrickWinHeight),
                href: this.$normalizeHref((buttonData.href || '#').toString()),
                targetBlank: this.$normalizeFlag(buttonData.targetBlank),
                title: title,
                ariaLabel: ariaLabel,
                disabled: this.$normalizeFlag(buttonData.disabled),
                fullWidth: this.$normalizeFlag(buttonData.fullWidth),
                onClick: this.$normalizeOnClick((buttonData.onClick || '').toString()),
                customClass: this.$sanitizeClassList(
                    (buttonData.customClass || buttonData.cssClass || '').toString()
                ),
                isDisabled: this.$normalizeFlag(buttonData.isDisabled)
            };
        },

        $getBtnStyle: function () {
            const rawBtnStyle = this.getAttribute('btnStyle');

            if (rawBtnStyle === 'icon' || rawBtnStyle === 'button') {
                return rawBtnStyle;
            }

            return 'iconRounded';
        },

        $getDisplayMode: function () {
            const btnStyle = this.$getBtnStyle();

            if (btnStyle === 'icon') {
                return 'icon-only';
            }

            if (btnStyle === 'iconRounded') {
                return 'icon-only-rounded';
            }

            return 'button';
        },

        $sanitizeClassList: function (classList) {
            return classList.split(/\s+/)
                .map((className) => className.trim())
                .filter((className) => /^[A-Za-z0-9_-]+$/.test(className))
                .join(' ');
        },

        $normalizeButtonType: function (btnType) {
            const allowed = [
                '',
                'primary',
                'primary-outline',
                'secondary',
                'secondary-outline',
                'success',
                'success-outline',
                'danger',
                'danger-outline',
                'warning',
                'warning-outline',
                'info',
                'info-outline',
                'light',
                'light-outline',
                'dark',
                'dark-outline',
                'white',
                'white-outline',
                'link',
                'link-body'
            ];

            btnType = (btnType || '').toString().trim();

            if (allowed.contains(btnType)) {
                return btnType;
            }

            return 'primary';
        },

        $normalizeButtonSize: function (size) {
            size = (size || '').toString().trim();

            if (size === 'sm' || size === 'lg' || size === 'default') {
                return size;
            }

            return '';
        },

        $normalizeDimension: function (value) {
            value = parseInt(value, 10);

            if (!isNaN(value) && value > 0) {
                return value;
            }

            return 0;
        },

        $normalizeFlag: function (value) {
            return value === true || value === 1 || value === '1';
        },

        $normalizeHref: function (href) {
            href = href.trim();

            if (!href) {
                return '#';
            }

            if (/^\s*(javascript|data):/i.test(href)) {
                return '#';
            }

            return href;
        },

        $normalizeOnClick: function (onClick) {
            onClick = onClick.trim();

            if (!onClick) {
                return '';
            }

            if (onClick.endsWith(';')) {
                onClick = onClick.slice(0, -1).trim();
            }

            if (/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(onClick)) {
                return `${onClick}();`;
            }

            const matches = onClick.match(/^([A-Za-z_$][A-Za-z0-9_$.]*)\((.*)\)$/s);

            if (!matches) {
                return '';
            }

            const args = matches[2].trim();

            if (/[;<>`]/.test(args)) {
                return '';
            }

            return `${matches[1]}(${args});`;
        },

        /**
         * The opener's parameters as a JSON string for the ajax, or an empty
         * string when there are none.
         *
         * They travel next to the attributes rather than inside them: the
         * attributes are an allowlist of brick settings, while these are
         * client supplied and must stay in the prefixed namespace.
         *
         * @return {string}
         */
        $getBrickParamsJson: function () {
            const brickParams = this.getAttribute('brickParams');

            if (!brickParams) {
                return '';
            }

            if (typeof brickParams === 'string') {
                return brickParams;
            }

            return typeof brickParams === 'object' ? JSON.stringify(brickParams) : '';
        },

        getControlAttributes: function () {
            let brickId = false;

            if (this.getElm().getAttribute('data-brickid')) {
                brickId = this.getElm().getAttribute('data-brickid');
            }

            if (!brickId && this.getAttribute('data-brickid')) {
                brickId = this.getAttribute('data-brickid');
            }

            return {
                'data-brickid': brickId,
                header: this.getAttribute('header'),
                content: this.getAttribute('content'),
                title: this.getAttribute('title'),
                description: this.getAttribute('description'),

                name_label: this.getAttribute('name_label'),
                name_placeholder: this.getAttribute('name_placeholder'),
                company_label: this.getAttribute('company_label'),
                company_placeholder: this.getAttribute('company_placeholder'),
                email_label: this.getAttribute('email_label'),
                email_placeholder: this.getAttribute('email_placeholder'),
                phone_label: this.getAttribute('phone_label'),
                phone_placeholder: this.getAttribute('phone_placeholder'),
                message_label: this.getAttribute('message_label'),
                message_placeholder: this.getAttribute('message_placeholder'),
                submit_label: this.getAttribute('submit_label'),

                // views
                startView: this.getAttribute('startView'),
                aiBrickId: this.getAttribute('aiBrickId'),
                aiContext: this.getAttribute('aiContext'),
                aiSidebar: this.getAttribute('aiSidebar'),

                // buttons
                btnStyle: this.getAttribute('btnStyle'),
                size: this.getAttribute('size'),
                whatsapp: this.getAttribute('whatsapp'),
                whatsappLabel: this.getAttribute('whatsappLabel'),
                phone: this.getAttribute('phone'),
                phoneLabel: this.getAttribute('phoneLabel'),
                email: this.getAttribute('email'),
                emailLabel: this.getAttribute('emailLabel'),
                customButtons: this.getAttribute('customButtons'),

                // design
                formDesign: this.getAttribute('formDesign'),
                bgColor: this.getAttribute('bgColor'),
                color: this.getAttribute('color'),
                leftBgColor: this.getAttribute('leftBgColor'),
                leftColor: this.getAttribute('leftColor'),
            };
        },

        /**
         * @return {Promise<string>}
         */
        getSuccessHtml: function () {
            let message = this.getAttribute('success_message');

            if (!message || message.length === 0) {
                message = QUILocale.get(lg, 'contact.ctaAction.send.success');
            }

            return new Promise((resolve) => {
                require([
                    'Mustache',
                    'text!package/quiqqer/contact/bin/controls/frontend/CtaAction.Success.html',
                    'css!package/quiqqer/contact/bin/controls/frontend/CtaAction.Success.css',
                ], function (Mustache, template) {
                    const html = Mustache.render(template, {
                        message: message
                    });

                    resolve(html);
                });
            });
        }
    });
});
