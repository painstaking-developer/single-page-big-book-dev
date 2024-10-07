let selectedText = '';

document.addEventListener('mouseup', handleTextSelection);
document.addEventListener('touchend', handleTextSelection);

function handleTextSelection() {
    selectedText = window.getSelection().toString();  // Update selectedText here
    const header = document.getElementById('tools');
    const googleLink = document.getElementById('google-link');

    if (selectedText) {
        header.style.display = 'block';
        googleLink.href = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`;
        googleLink.textContent = `Search "${selectedText}" on Google`;
    } else {
        header.style.display = 'none';
    }
}

function copyLink() {
    const url = window.location.href;
    const formattedLink = `${url}#:~:text=${encodeURIComponent(selectedText)}`;

    navigator.clipboard.writeText(formattedLink)
        .then(() => {
            console.log('Link copied to clipboard:', formattedLink);
        })
        .catch(err => console.error('Error copying text: ', err));

    // Hide the footer after copying
    document.getElementById('tools').style.display = 'none';
}

function hideHeaderToolbar() {
    document.getElementById('tools').style.display = 'none'
}


function highlightParagraph() {
    // Remove existing highlights
    const highlighted = document.querySelector('.highlight');
    if (highlighted) {
        highlighted.classList.remove('highlight');
    }

    // Highlight the new paragraph
    const hash = window.location.hash;
    if (hash) {
        const element = document.querySelector(hash);
        if (element) {
            element.classList.add('highlight');
            // Scroll up slightly
            const offset = 50; // Adjust this value as needed
            const topPosition = element.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: topPosition });
        }
    }
}

function getSelectedText() {
    return window.getSelection().toString();
}

document.addEventListener("DOMContentLoaded", highlightParagraph);
window.addEventListener("hashchange", highlightParagraph);

window.addEventListener('scroll', function() {
    const headers = document.querySelectorAll('header');
    headers.forEach(header => {
        const rect = header.getBoundingClientRect();
        if (rect.top <= 0) {
            header.classList.add('shadow');
        } else {
            header.classList.remove('shadow');
        }
    });
});
