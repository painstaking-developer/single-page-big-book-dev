let selectedText = '';

document.addEventListener('mouseup', function() {
    selectedText = window.getSelection().toString();
    const footer = document.getElementById('footer');
    const googleLink = document.getElementById('google-link');

    if (selectedText) {
        footer.style.display = 'block';
        googleLink.href = `https://www.google.com/search?q=${encodeURIComponent(selectedText)}`;
    } else {
        footer.style.display = 'none';
    }
});

function copyLink() {
    const url = window.location.href;
    const formattedLink = `${url}#:~:text=${encodeURIComponent(selectedText)}`;

    navigator.clipboard.writeText(formattedLink)
        .catch(err => console.error('Error copying text: ', err));

    // Hide the footer after copying
    document.getElementById('footer').style.display = 'none';
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
        }
    }
}

function getSelectedText() {
        return window.getSelection().toString();
    }

document.addEventListener("DOMContentLoaded", highlightParagraph);
window.addEventListener("hashchange", highlightParagraph);
