/** Content sizing shared by the dedicated CTA window and a generic BrickWindow. */
define('package/quiqqer/contact/bin/controls/frontend/CtaActionWindowSizing', [
    'qui/QUI',
    'qui/controls/windows/SimpleWindow'
], function (QUI, SimpleWindow) {
    'use strict';

    return {
        attach: function (control, layout) {
            let node = layout.parentElement;
            let win = null;

            // Imported controls have no QUI parent; find the owning window via
            // registered ancestor controls, without relying on styling classes.
            while (node) {
                const candidate = QUI.Controls.getById(node.getAttribute('data-quiid'));
                if (candidate instanceof SimpleWindow) {
                    win = candidate;
                    break;
                }
                node = node.parentElement;
            }

            if (!win) {
                return null;
            }

            const root = layout.parentElement;
            root.classList.add('quiqqer-contact-ctaAction--inWindow');
            const content = win.getContent();
            const originalMaxHeight = win.getAttribute('maxHeight');
            const workHeight = Number(originalMaxHeight) || 800;
            let frame = 0;
            let resizing = false;
            let pending = false;
            let disposed = false;
            const opener = document.activeElement;
            const title = layout.querySelector('[data-name="viewTitle"]');
            node.setAttribute('role', 'dialog');
            node.setAttribute('aria-modal', 'true');
            if (title) {
                node.setAttribute('aria-label', title.textContent.trim());
            }

            const keepFocusInWindow = (event) => {
                if (event.key !== 'Tab') {
                    return;
                }
                const focusable = Array.from(node.querySelectorAll(
                    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]),'
                    + ' select:not([disabled]), a[href]:not([aria-disabled="true"]), [tabindex="0"]'
                )).filter((element) => element.getClientRects().length > 0);
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (first && event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
                    event.preventDefault();
                    last.focus();
                } else if (last && !event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            };
            node.addEventListener('keydown', keepFocusInWindow);
            const focusView = () => {
                if (!disposed && !win.getAttribute('contentPending')) {
                    const view = layout.querySelector('[data-name="' + control.$viewElementName(layout.dataset.activeView) + '"]');
                    if (view) {
                        control.$focusView(view);
                    }
                }
            };
            requestAnimationFrame(focusView);
            win.addEvent('open', focusView);

            const measure = () => {
                if (layout.dataset.activeView === 'ai') {
                    return workHeight;
                }

                // The layout has height:auto outside chat. Its rendered height
                // includes wrapped buttons and a stacked or adjacent sidebar.
                // Only add the actual enclosing boxes' vertical padding/borders.
                let height = layout.getBoundingClientRect().height;
                let parent = layout.parentElement;
                while (parent && parent !== node.parentElement) {
                    const style = getComputedStyle(parent);
                    height += ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
                        .reduce((sum, property) => sum + (parseFloat(style[property]) || 0), 0);
                    if (parent === node) {
                        break;
                    }
                    parent = parent.parentElement;
                }
                return Math.min(Math.ceil(height), workHeight);
            };

            const update = () => {
                frame = 0;
                if (disposed || !root.isConnected || win.getAttribute('contentPending')) {
                    return;
                }
                if (resizing) {
                    pending = true;
                    return;
                }

                const mobile = window.matchMedia('(max-width: 767px)').matches;
                const height = mobile ? workHeight : measure();
                if (height <= 0 || Number(win.getAttribute('maxHeight')) === height) {
                    return;
                }
                win.setAttribute('maxHeight', height);
                resizing = true;
                Promise.resolve(win.resize()).finally(() => {
                    resizing = false;
                    if (pending) {
                        pending = false;
                        schedule();
                    }
                });
            };
            const schedule = () => {
                if (!disposed && !frame) {
                    frame = requestAnimationFrame(update);
                }
            };
            const prepareHeight = () => {
                const height = window.matchMedia('(max-width: 767px)').matches ? workHeight : measure();
                if (height > 0) {
                    win.setAttribute('maxHeight', height);
                }
            };
            win.addEvent('contentReady', prepareHeight);
            const observer = new ResizeObserver(schedule);
            observer.observe(layout);
            observer.observe(root);
            content.addEventListener('quiqqer-contact-ctaAction-viewChange', schedule);
            content.addEventListener('quiqqer-contact-ctaAction-aiMounted', schedule);
            window.addEventListener('resize', schedule);
            win.addEvent('resize', schedule);

            const dispose = () => {
                disposed = true;
                observer.disconnect();
                node.removeEventListener('keydown', keepFocusInWindow);
                if (node.contains(document.activeElement) && opener?.isConnected) {
                    opener.focus({preventScroll: true});
                }
                cancelAnimationFrame(frame);
                window.removeEventListener('resize', schedule);
                content.removeEventListener('quiqqer-contact-ctaAction-viewChange', schedule);
                content.removeEventListener('quiqqer-contact-ctaAction-aiMounted', schedule);
                win.removeEvent('resize', schedule);
                win.removeEvent('contentReady', prepareHeight);
                win.removeEvent('open', focusView);
                win.removeEvent('closeBegin', dispose);
                control.removeEvent('destroy', dispose);
                win.setAttribute('maxHeight', originalMaxHeight);
            };
            win.addEvent('closeBegin', dispose);
            control.addEvent('destroy', dispose);
            schedule();
            return {dispose: dispose};
        }
    };
});
