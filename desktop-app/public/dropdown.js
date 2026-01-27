// dropdown.js - Custom Dropdown Component
// Converts native <select> elements to styled custom dropdowns

(function () {
    'use strict';

    const CHEVRON_SVG = `<svg class="custom-dropdown-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

    const CHECK_SVG = `<svg class="custom-dropdown-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    /**
     * Creates a custom dropdown from a native select element
     * @param {HTMLSelectElement} select - The select element to convert
     */
    function createCustomDropdown(select) {
        // Skip if already converted
        if (select.dataset.customDropdown === 'true') return;

        // Mark as converted
        select.dataset.customDropdown = 'true';
        select.style.display = 'none';

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-dropdown';

        // Preserve width from original select or use defaults
        const computedStyle = window.getComputedStyle(select);
        const originalWidth = select.style.width || computedStyle.width;

        // Default fixed widths for specific IDs to ensure stability
        const fixedWidths = {
            'filter-turma': '180px',
            'filter-turno': '160px',
            'filter-mes-select': '130px',
            'select-serial-port': '220px'
        };

        if (fixedWidths[select.id]) {
            wrapper.style.width = fixedWidths[select.id];
        } else if (originalWidth && originalWidth !== 'auto') {
            wrapper.style.width = originalWidth;
        } else {
            wrapper.style.width = '100%'; // Default to full width for others
        }

        // Create trigger button
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-dropdown-trigger';

        // Get initial selected option
        const selectedOption = select.options[select.selectedIndex];
        const initialText = selectedOption ? selectedOption.text : 'Selecione...';
        const isPlaceholder = !selectedOption || selectedOption.value === '';

        trigger.innerHTML = `
      <span class="custom-dropdown-value">${initialText}</span>
      ${CHEVRON_SVG}
    `;

        if (isPlaceholder) {
            trigger.classList.add('placeholder');
        }

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'custom-dropdown-menu';

        // Populate options
        function populateOptions() {
            menu.innerHTML = '';
            Array.from(select.options).forEach((option, index) => {
                const optionEl = document.createElement('div');
                optionEl.className = 'custom-dropdown-option';
                optionEl.dataset.value = option.value;
                optionEl.dataset.index = index;

                if (option.selected) {
                    optionEl.classList.add('selected');
                }

                optionEl.innerHTML = `${CHECK_SVG}<span>${option.text}</span>`;

                optionEl.addEventListener('click', () => {
                    selectOption(optionEl, option);
                });

                menu.appendChild(optionEl);
            });
        }

        populateOptions();

        // Select option handler
        function selectOption(optionEl, option) {
            // Update native select
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));

            // Update visual state
            menu.querySelectorAll('.custom-dropdown-option').forEach(el => {
                el.classList.remove('selected');
            });
            optionEl.classList.add('selected');

            // Update trigger text
            trigger.querySelector('.custom-dropdown-value').textContent = option.text;
            trigger.classList.toggle('placeholder', option.value === '');

            // Close dropdown
            closeDropdown();
        }

        // Toggle dropdown
        function toggleDropdown() {
            const isOpen = trigger.classList.contains('open');

            // Close all other dropdowns first
            document.querySelectorAll('.custom-dropdown-trigger.open').forEach(t => {
                if (t !== trigger) {
                    t.classList.remove('open');
                    t.nextElementSibling.classList.remove('open');
                }
            });

            trigger.classList.toggle('open', !isOpen);
            menu.classList.toggle('open', !isOpen);

            // Scroll selected into view
            if (!isOpen) {
                const selected = menu.querySelector('.selected');
                if (selected) {
                    setTimeout(() => {
                        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 50);
                }
            }
        }

        function closeDropdown() {
            trigger.classList.remove('open');
            menu.classList.remove('open');
        }

        // Event listeners
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown();
        });

        // Keyboard navigation
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleDropdown();
            } else if (e.key === 'Escape') {
                closeDropdown();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (!trigger.classList.contains('open')) {
                    toggleDropdown();
                }
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                closeDropdown();
            }
        });

        // Assemble component
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);
        wrapper.appendChild(select);

        // Watch for select changes (for dynamic options)
        const observer = new MutationObserver(() => {
            populateOptions();
            // Update trigger text
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt) {
                trigger.querySelector('.custom-dropdown-value').textContent = selectedOpt.text;
                trigger.classList.toggle('placeholder', selectedOpt.value === '');
            }
        });

        observer.observe(select, { childList: true, subtree: true });

        // Store reference for external updates
        wrapper._updateValue = () => {
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt) {
                trigger.querySelector('.custom-dropdown-value').textContent = selectedOpt.text;
                trigger.classList.toggle('placeholder', selectedOpt.value === '');
                menu.querySelectorAll('.custom-dropdown-option').forEach((el, i) => {
                    el.classList.toggle('selected', i === select.selectedIndex);
                });
            }
        };

        return wrapper;
    }

    /**
     * Initialize all select elements matching the selector
     * @param {string} selector - CSS selector for selects to convert
     */
    function initCustomDropdowns(selector = 'select[data-custom-dropdown]') {
        document.querySelectorAll(selector).forEach(select => {
            createCustomDropdown(select);
        });
    }

    /**
     * Convert a specific select to custom dropdown
     * @param {HTMLSelectElement|string} selectOrId - Select element or its ID
     */
    function convertSelect(selectOrId) {
        const select = typeof selectOrId === 'string'
            ? document.getElementById(selectOrId)
            : selectOrId;
        if (select && select.tagName === 'SELECT') {
            return createCustomDropdown(select);
        }
    }

    // Auto-initialize on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[CustomDropdown] Initializing dropdowns...');
        initializeAllDropdowns();
    });

    // Fallback: also try on window load in case DOMContentLoaded already fired
    window.addEventListener('load', () => {
        console.log('[CustomDropdown] Window load - checking for unconverted dropdowns...');
        initializeAllDropdowns();
    });

    function initializeAllDropdowns() {
        // Convert all selects with the custom attribute
        initCustomDropdowns('select[data-custom-dropdown]');

        // Also auto-convert specific selects by ID
        const selectIds = [
            'select-serial-port',
            'email-mode-select',
            'filter-turma',
            'filter-turno',
            'filter-mes-select',
            'modal-genero',
            'modal-cabine'
        ];

        let converted = 0;
        selectIds.forEach(id => {
            const select = document.getElementById(id);
            if (select && select.dataset.customDropdown !== 'true') {
                console.log('[CustomDropdown] Converting:', id);
                createCustomDropdown(select);
                converted++;
            }
        });
        console.log('[CustomDropdown] Converted ' + converted + ' dropdowns');
    }

    // Expose to global scope
    window.CustomDropdown = {
        init: initCustomDropdowns,
        convert: convertSelect,
        create: createCustomDropdown,
        initAll: initializeAllDropdowns
    };

})();
