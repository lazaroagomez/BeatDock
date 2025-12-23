/**
 * BeatDock Documentation - Interactive Features
 * Cyberpunk Gaming Theme with Discord Aesthetics
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all features
    initParticles();
    initNavigation();
    initScrollAnimations();
    initCopyButtons();
    initSmoothScroll();
    initNavbarScroll();
    fetchVersion();
});

/**
 * Fetch current version from GitHub package.json
 */
function fetchVersion() {
    const versionElement = document.getElementById('version');
    if (!versionElement) return;

    fetch('https://raw.githubusercontent.com/lazaroagomez/BeatDock/main/package.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch');
            return response.json();
        })
        .then(data => {
            if (data.version) {
                versionElement.textContent = `v${data.version}`;
                versionElement.style.opacity = '1';
            }
        })
        .catch(error => {
            console.warn('Could not fetch version:', error);
            // Keep the fallback version already in HTML
        });
}

/**
 * Floating Particles Background
 */
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const particleCount = 30;
    const colors = ['#5865F2', '#00ff88', '#ff006e', '#00d4ff'];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        // Random properties
        const size = Math.random() * 3 + 1;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const delay = Math.random() * 15;
        const duration = Math.random() * 10 + 10;

        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            left: ${left}%;
            animation-delay: ${delay}s;
            animation-duration: ${duration}s;
            box-shadow: 0 0 ${size * 2}px ${color};
        `;

        container.appendChild(particle);
    }
}

/**
 * Mobile Navigation Toggle
 */
function initNavigation() {
    const toggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (!toggle || !mobileMenu) return;

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        mobileMenu.classList.toggle('active');
        document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking links
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
            toggle.classList.remove('active');
            mobileMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

/**
 * Scroll-triggered Animations
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements
    const animatedElements = document.querySelectorAll(
        '.feature-card, .command-card, .step, .config-group, .command-group'
    );

    animatedElements.forEach((el, index) => {
        el.style.transitionDelay = `${index * 0.05}s`;
        observer.observe(el);
    });
}

/**
 * Copy to Clipboard Functionality
 */
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');

    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const textToCopy = button.dataset.copy;

            try {
                await navigator.clipboard.writeText(textToCopy);

                // Visual feedback
                const originalText = button.querySelector('.copy-text').textContent;
                button.classList.add('copied');
                button.querySelector('.copy-text').textContent = 'Copied!';
                button.querySelector('.copy-icon').textContent = '\u2713';

                setTimeout(() => {
                    button.classList.remove('copied');
                    button.querySelector('.copy-text').textContent = originalText;
                    button.querySelector('.copy-icon').textContent = '\uD83D\uDCCB';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);

                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();

                try {
                    document.execCommand('copy');
                    button.classList.add('copied');
                    button.querySelector('.copy-text').textContent = 'Copied!';

                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.querySelector('.copy-text').textContent = 'Copy';
                    }, 2000);
                } catch (e) {
                    console.error('Fallback copy failed:', e);
                }

                document.body.removeChild(textArea);
            }
        });
    });

    // Docker cards copy functionality
    const dockerCards = document.querySelectorAll('.docker-card');
    dockerCards.forEach(card => {
        card.addEventListener('click', async () => {
            const code = card.querySelector('code');
            if (!code) return;

            const textToCopy = code.textContent;

            try {
                await navigator.clipboard.writeText(textToCopy);

                // Visual feedback
                const originalText = code.textContent;
                code.textContent = 'Copied!';
                code.style.color = '#57F287';

                setTimeout(() => {
                    code.textContent = originalText;
                    code.style.color = '';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

/**
 * Smooth Scrolling for Anchor Links
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;

            e.preventDefault();
            const target = document.querySelector(href);

            if (target) {
                const navHeight = document.querySelector('.nav').offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL without scrolling
                history.pushState(null, null, href);
            }
        });
    });
}

/**
 * Navbar Background on Scroll
 */
function initNavbarScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add scrolled class
        if (currentScroll > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    }, { passive: true });
}

/**
 * Typing effect for code blocks (optional enhancement)
 */
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }

    type();
}

/**
 * Add hover glow effect to cards
 */
document.querySelectorAll('.feature-card, .command-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

/**
 * Keyboard navigation support
 */
document.addEventListener('keydown', (e) => {
    // Quick navigation with keyboard
    const shortcuts = {
        'f': '#features',
        'c': '#commands',
        's': '#setup',
        'g': '#config'
    };

    // Only activate with Ctrl/Cmd + key
    if ((e.ctrlKey || e.metaKey) && shortcuts[e.key.toLowerCase()]) {
        e.preventDefault();
        const target = document.querySelector(shortcuts[e.key.toLowerCase()]);
        if (target) {
            const navHeight = document.querySelector('.nav').offsetHeight;
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
    }
});

/**
 * Reduce motion for users who prefer it
 */
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--animation-duration', '0.01ms');

    // Remove particle animations
    const particles = document.querySelectorAll('.particle');
    particles.forEach(p => p.remove());
}

/**
 * Console Easter Egg
 */
console.log('%c BeatDock ', 'background: linear-gradient(135deg, #5865F2, #ff006e); color: white; font-size: 24px; font-weight: bold; padding: 10px 20px; border-radius: 8px;');
console.log('%c Drop the beat. Control the vibe. ', 'color: #00ff88; font-size: 14px;');
console.log('%c https://github.com/lazaroagomez/BeatDock ', 'color: #5865F2;');
