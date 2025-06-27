document.addEventListener('DOMContentLoaded', () => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Typewriter effect for hero title - PRIORITY
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle && !prefersReducedMotion) {
        const text = heroTitle.getAttribute('data-text') || heroTitle.textContent.trim();
        heroTitle.textContent = '';
        heroTitle.style.opacity = '1';
        
        let index = 0;
        const typeSpeed = 15; // Very fast (15ms per character)
        
        function typeWriter() {
            if (index < text.length) {
                heroTitle.textContent += text.charAt(index);
                index++;
                setTimeout(typeWriter, typeSpeed);
            }
        }
        
        // Start typing immediately
        typeWriter();
        
        // Safety fallback - ensure text is shown
        setTimeout(() => {
            if (heroTitle.textContent !== text) {
                heroTitle.textContent = text;
            }
        }, 1000); // 1 second fallback
    } else if (heroTitle) {
        // For reduced motion, just show the text
        heroTitle.style.opacity = '1';
    }

    // Immediately show hero content
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) {
        heroContent.classList.add('visible');
    }
    
    // Close mobile menu when clicking nav links
    const navLinks = document.querySelectorAll('.navbar-nav a');
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const navbarToggler = document.querySelector('.navbar-toggler');
    
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navbarCollapse.classList.contains('show')) {
                navbarToggler.click();
            }
        });
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Copy to clipboard functionality with enhanced feedback
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const codeBlock = button.parentElement.querySelector('code');
            const textToCopy = codeBlock.innerText;
            
            try {
                await navigator.clipboard.writeText(textToCopy);
                
                // Success animation
                button.innerHTML = '<i class="fas fa-check"></i>';
                button.style.background = '#43B581';
                button.style.borderColor = '#43B581';
                button.style.color = '#FFFFFF';
                
                // Show tooltip
                const tooltip = document.createElement('div');
                tooltip.className = 'copy-tooltip';
                tooltip.textContent = 'Copied!';
                button.appendChild(tooltip);
                
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                    button.style.background = '';
                    button.style.borderColor = '';
                    button.style.color = '';
                    if (button.contains(tooltip)) {
                        button.removeChild(tooltip);
                    }
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
                button.innerHTML = '<i class="fas fa-times"></i>';
                button.style.background = '#F04747';
                button.style.borderColor = '#F04747';
                
                setTimeout(() => {
                    button.innerHTML = '<i class="fas fa-copy"></i>';
                    button.style.background = '';
                    button.style.borderColor = '';
                }, 2000);
            }
        });
    });

    // Navbar background opacity on scroll
    const navbar = document.querySelector('.nav-glass');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.style.background = 'rgba(26, 31, 46, 0.95)';
            navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(26, 31, 46, 0.7)';
            navbar.style.boxShadow = '';
        }
        
        lastScroll = currentScroll;
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                
                // Add stagger effect for grid items
                if (entry.target.classList.contains('feature-card') || 
                    entry.target.classList.contains('command-item')) {
                    const index = Array.from(entry.target.parentElement.children).indexOf(entry.target);
                    entry.target.style.animationDelay = `${index * 0.1}s`;
                }
            }
        });
    }, observerOptions);

    // Observe elements
    const animateElements = document.querySelectorAll(
        '.feature-card, .command-item, .setup-step, .permission-card, .section-header'
    );
    
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Parallax effect for hero section
    const heroSection = document.querySelector('.hero-section');
    
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        
        if (heroContent && scrolled < heroSection.offsetHeight) {
            heroContent.style.transform = `translateY(${rate}px)`;
        }
    });

    // Interactive glow orbs
    const glowOrbs = document.querySelectorAll('.glow-orb');
    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    const speed = 0.05;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateOrbs() {
        currentX += (mouseX - currentX) * speed;
        currentY += (mouseY - currentY) * speed;

        glowOrbs.forEach((orb, index) => {
            const offsetX = (currentX - window.innerWidth / 2) * (0.1 * (index + 1));
            const offsetY = (currentY - window.innerHeight / 2) * (0.1 * (index + 1));
            
            orb.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        });

        requestAnimationFrame(animateOrbs);
    }

    animateOrbs();

    // Command badges hover effect
    const commandBadges = document.querySelectorAll('.command-item .badge');
    commandBadges.forEach(badge => {
        badge.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
        });
        
        badge.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });

    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            this.appendChild(ripple);
            
            const x = e.clientX - e.target.offsetLeft;
            const y = e.clientY - e.target.offsetTop;
            
            ripple.style.left = `${x}px`;
            ripple.style.top = `${y}px`;
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add loading animation removal
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
    });
}); 