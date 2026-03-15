const notesEnabled = checkForTestParameter();
let currentNoteContent = '';
let notesById = {};
let syncDirHandle = null;
let currentNoteElementId = '';

// IndexedDB helpers for persisting the directory handle across sessions
function openSyncDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('notesSyncDB', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('handles');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveDirHandle(handle) {
    const db = await openSyncDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, 'syncDir');
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function loadDirHandle() {
    const db = await openSyncDB();
    const tx = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('syncDir');
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function clearDirHandle() {
    const db = await openSyncDB();
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').delete('syncDir');
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

window.addEventListener('load', async () => {
    const storedNotes = localStorage.getItem('notesById');
    if (storedNotes) {
        notesById = JSON.parse(storedNotes);
        notes.placeNoteToggles();
    }

    // Restore folder sync handle from previous session
    if ('showDirectoryPicker' in window) {
        try {
            const handle = await loadDirHandle();
            if (handle) {
                const perm = await handle.queryPermission({ mode: 'readwrite' });
                if (perm === 'granted') {
                    syncDirHandle = handle;
                    updateSyncButton();
                }
            }
        } catch (e) {
            console.log('Could not restore sync folder:', e);
        }
    }
});

const notesModule = {
  addEmojiAfterElement(element, emoji = '\uD83D\uDCAD') {
    if (!notesEnabled) return;
    if (!element.querySelector('.notes-toggle')) {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        emojiSpan.className = 'notes-toggle';
        element.insertAdjacentElement('afterend', emojiSpan);
    }
  },

  removeEmojiAfterElement() {
      if (!notesEnabled) return;

      const emojiElements = document.querySelectorAll('.notes-toggle');
      emojiElements.forEach(emoji => {
          const previousElement = emoji.previousElementSibling;
          if (previousElement && !notesById.hasOwnProperty(previousElement.id)) {
              emoji.remove();
          }
      });
    },

  elementAlreadyHasToggleBtn(element) {
    const nextSibling = element.nextElementSibling;
    return nextSibling && nextSibling.classList.contains('notes-toggle');
  },

  highlightAdded(element) {
    if (!notesEnabled) return;
    if (!notes.elementAlreadyHasToggleBtn(element)) {
        notesModule.addEmojiAfterElement(element);
    }
  },

  highlightRemoved(highlighted) {
    if (!notesEnabled) return;
    notesModule.removeEmojiAfterElement();
  },

  openPane() {
    document.getElementById('notes-overlay').classList.add('active');
    document.getElementById('notes-pane').classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  closePane() {
    document.getElementById('notes-overlay').classList.remove('active');
    document.getElementById('notes-pane').classList.remove('active');
    document.body.style.overflow = '';
    currentNoteElementId = '';
    currentNoteContent = '';
  },

  parseElementRef(elementId) {
    const parts = {};
    const pgMatch = elementId.match(/pg(.+?)(?=-par|$)/);
    const parMatch = elementId.match(/par(\d+)/);
    const senMatch = elementId.match(/sen(\d+)/);
    if (pgMatch) parts.page = pgMatch[1].replace(/_/g, ' ');
    if (parMatch) parts.paragraph = parMatch[1];
    if (senMatch) parts.sentence = senMatch[1];
    return parts;
  },

  buildQuoteBox(elementId) {
    const element = document.getElementById(elementId);
    const quoteText = element ? element.textContent.trim() : elementId;

    const quoteBox = document.createElement('div');
    quoteBox.className = 'notes-quote-box';

    const text = document.createElement('div');
    text.className = 'notes-quote-text';
    text.textContent = quoteText;
    quoteBox.appendChild(text);

    const ref = notesModule.parseElementRef(elementId);
    if (ref.page) {
        const refLine = document.createElement('div');
        refLine.className = 'notes-quote-ref';
        const parts = [];
        parts.push('Page ' + ref.page);
        if (ref.paragraph) parts.push('Paragraph ' + ref.paragraph);
        if (ref.sentence) parts.push('Sentence ' + ref.sentence);
        refLine.textContent = parts.join(' / ');
        quoteBox.appendChild(refLine);
    }

    return quoteBox;
  },

  renderPane(elementId) {
    currentNoteElementId = elementId;
    currentNoteContent = '';
    const container = document.getElementById('notes-pane-content');
    container.innerHTML = '';

    // Quote box
    container.appendChild(notesModule.buildQuoteBox(elementId));

    // Existing notes
    if (notesById[elementId] && notesById[elementId].length > 0) {
        const notesForElement = notesById[elementId];

        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        headerRow.style.marginBottom = '8px';

        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'notes-section-label';
        sectionLabel.textContent = notesForElement.length === 1 ? '1 Note' : notesForElement.length + ' Notes';
        headerRow.appendChild(sectionLabel);

        if (notesForElement.length > 1) {
            const expandAllBtn = document.createElement('button');
            expandAllBtn.textContent = 'Expand All';
            expandAllBtn.className = 'notes-expand-all';
            expandAllBtn.addEventListener('click', () => {
                const allContent = container.querySelectorAll('.note-card-body');
                const allExpanded = Array.from(allContent).every(el => el.classList.contains('note-expanded'));
                allContent.forEach(el => {
                    if (allExpanded) el.classList.remove('note-expanded');
                    else el.classList.add('note-expanded');
                });
                expandAllBtn.textContent = allExpanded ? 'Expand All' : 'Collapse All';
            });
            headerRow.appendChild(expandAllBtn);
        }

        container.appendChild(headerRow);

        notesForElement.forEach((note, index) => {
            container.appendChild(notesModule.renderNoteItem(note, index, elementId));
        });

        const divider = document.createElement('hr');
        divider.className = 'notes-divider';
        container.appendChild(divider);
    }

    // New note form
    const addLabel = document.createElement('div');
    addLabel.className = 'notes-section-label';
    addLabel.textContent = 'Add a Note';
    container.appendChild(addLabel);

    const textarea = document.createElement('textarea');
    textarea.id = 'note-textarea';
    textarea.placeholder = 'Write your note here...';
    textarea.addEventListener('input', (e) => { currentNoteContent = e.target.value; });
    container.appendChild(textarea);

    const msg = document.createElement('small');
    msg.id = 'note-message';
    msg.textContent = '';
    container.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.classList.add('note-btn-row');

    const saveBtn = document.createElement('button');
    saveBtn.id = 'note-save-btn';
    saveBtn.className = 'notes-btn';
    const saveIcon = document.createElement('span');
    saveIcon.className = 'notes-btn-icon';
    saveIcon.innerHTML = '&#128190;';
    saveBtn.appendChild(saveIcon);
    saveBtn.appendChild(document.createTextNode('Save'));
    saveBtn.addEventListener('click', () => notesModule.saveNote());
    btnRow.appendChild(saveBtn);

    container.appendChild(btnRow);

    notesModule.openPane();
  },

  toggleNoteContent(targetElement) {
    const previousElement = targetElement.previousElementSibling;
    if (previousElement) {
        const elementId = previousElement.id;
        // If pane is already open for this element, close it
        if (document.getElementById('notes-pane').classList.contains('active') && currentNoteElementId === elementId) {
            notesModule.closePane();
            return;
        }
        notesModule.renderPane(elementId);
    }
  },

  renderNoteItem(note, index, elementId) {
    const card = document.createElement('div');
    card.classList.add('note-card');

    const body = document.createElement('div');
    body.classList.add('note-card-body');
    body.textContent = note.contents;
    body.addEventListener('click', () => {
        body.classList.toggle('note-expanded');
    });
    card.appendChild(body);

    const footer = document.createElement('div');
    footer.classList.add('note-card-footer');

    const dateEl = document.createElement('span');
    dateEl.classList.add('note-date');
    dateEl.textContent = note.createdDate ? note.createdDate.substring(0, 10) : '';
    footer.appendChild(dateEl);

    const actions = document.createElement('div');
    actions.classList.add('note-card-actions');

    const copyBtn = document.createElement('span');
    copyBtn.classList.add('note-action-btn');
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = '&#128203;';
    copyBtn.addEventListener('click', () => {
        const element = document.getElementById(elementId);
        const quoteText = element ? element.textContent.trim() : '';
        const ref = notesModule.parseElementRef(elementId);
        const parts = [];
        if (ref.page) parts.push('Page ' + ref.page);
        if (ref.paragraph) parts.push('Paragraph ' + ref.paragraph);
        if (ref.sentence) parts.push('Sentence ' + ref.sentence);
        let text = '';
        if (quoteText) text += '> ' + quoteText + '\n';
        if (parts.length) text += parts.join(' / ') + '\n';
        if (note.createdDate) text += note.createdDate + '\n';
        text += '\n' + note.contents;
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '&#10003;';
            setTimeout(() => { copyBtn.innerHTML = '&#128203;'; }, 1500);
        });
    });
    actions.appendChild(copyBtn);

    const editBtn = document.createElement('span');
    editBtn.classList.add('note-action-btn');
    editBtn.title = 'Edit';
    editBtn.innerHTML = '&#9998;';
    editBtn.addEventListener('click', () => {
        notesModule.enterEditMode(elementId, index);
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('span');
    deleteBtn.classList.add('note-action-btn', 'note-action-delete');
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = '&#128465;';
    deleteBtn.addEventListener('click', () => {
        if (confirm('Delete this note? This action cannot be undone.')) {
            notesModule.deleteNote(elementId, index);
            notesModule.renderPane(elementId);
        }
    });
    actions.appendChild(deleteBtn);

    footer.appendChild(actions);
    card.appendChild(footer);
    return card;
  },

  enterEditMode(elementId, noteIndex) {
    const note = notesById[elementId][noteIndex];
    const container = document.getElementById('notes-pane-content');
    container.innerHTML = '';

    // Quote box (always shown)
    container.appendChild(notesModule.buildQuoteBox(elementId));

    const heading = document.createElement('h4');
    heading.textContent = 'Edit Note';
    container.appendChild(heading);

    const textarea = document.createElement('textarea');
    textarea.id = 'note-textarea';
    textarea.value = note.contents;
    container.appendChild(textarea);

    const msg = document.createElement('small');
    msg.id = 'note-message';
    msg.textContent = '';
    container.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.classList.add('note-btn-row');

    const saveBtn = document.createElement('button');
    saveBtn.className = 'notes-btn';
    const saveIcon = document.createElement('span');
    saveIcon.className = 'notes-btn-icon';
    saveIcon.innerHTML = '&#128190;';
    saveBtn.appendChild(saveIcon);
    saveBtn.appendChild(document.createTextNode('Save'));
    saveBtn.addEventListener('click', () => {
        const newContent = textarea.value.trim();
        if (!newContent) {
            msg.textContent = 'Please write something first.';
            msg.style.color = 'red';
            return;
        }
        notesById[elementId][noteIndex].contents = newContent;
        localStorage.setItem('notesById', JSON.stringify(notesById));
        notesModule.syncFileForElement(elementId);
        notesModule.renderPane(elementId);
    });
    btnRow.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'notes-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        notesModule.renderPane(elementId);
    });
    btnRow.appendChild(cancelBtn);

    container.appendChild(btnRow);
    textarea.focus();
  },

  async syncFileForElement(elementId) {
    if (!syncDirHandle) return;
    try {
        const notesList = notesById[elementId];
        const safeFilename = elementId.replace(/[^a-zA-Z0-9_-]/g, '_') + '.md';

        if (!notesList || notesList.length === 0) {
            try {
                await syncDirHandle.removeEntry(safeFilename);
            } catch (e) {
                // File may not exist, that's fine
            }
            return;
        }

        const element = document.getElementById(elementId);
        const sourceText = element ? element.textContent.trim() : '';

        let markdown = `# ${elementId}\n\n`;
        if (sourceText) {
            markdown += `> ${sourceText}\n\n`;
        }
        notesList.forEach((note) => {
            markdown += `**${note.createdDate || 'No date'}**\n\n`;
            markdown += `${note.contents}\n\n---\n\n`;
        });

        const fileHandle = await syncDirHandle.getFileHandle(safeFilename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(markdown);
        await writable.close();
    } catch (err) {
        console.error('Auto-sync error for', elementId, err);
    }
  },

  saveNote() {
    const currentDate = getFormattedDateTime();
    const elementId = currentNoteElementId;

    if (!currentNoteContent.trim()) {
        const noteMsg = document.getElementById('note-message');
        noteMsg.textContent = 'Please write something first.';
        noteMsg.style.color = 'red';
        return;
    }

    if (!notesById[elementId]) {
        notesById[elementId] = [];
    }

    notesById[elementId].push({
        contents: currentNoteContent,
        createdDate: currentDate,
        id: elementId
    });

    localStorage.setItem('notesById', JSON.stringify(notesById));
    currentNoteContent = '';

    notesModule.placeNoteToggles();
    notesModule.syncFileForElement(elementId);
    notesModule.renderPane(elementId);
  },

  deleteNote(elementId, noteIndex) {
    if (notesById[elementId]) {
        notesById[elementId].splice(noteIndex, 1);
        if (notesById[elementId].length === 0) {
            delete notesById[elementId];
            // Remove the toggle emoji if no notes remain
            const element = document.getElementById(elementId);
            if (element) {
                const nextSibling = element.nextElementSibling;
                if (nextSibling && nextSibling.classList.contains('notes-toggle')) {
                    nextSibling.remove();
                }
            }
        }
        localStorage.setItem('notesById', JSON.stringify(notesById));
        notesModule.syncFileForElement(elementId);
    }
  },

  exportNotesAsMarkdown() {
    if (Object.keys(notesById).length === 0) {
        alert('No notes to export.');
        return;
    }

    let markdown = '# Notes\n\n';
    markdown += `Exported: ${getFormattedDateTime()}\n\n`;

    for (const [elementId, notesList] of Object.entries(notesById)) {
        const element = document.getElementById(elementId);
        const sourceText = element ? element.textContent.trim() : '';

        markdown += `## ${elementId}\n\n`;
        if (sourceText) {
            markdown += `> ${sourceText}\n\n`;
        }

        notesList.forEach((note) => {
            markdown += `**${note.createdDate || 'No date'}**\n\n`;
            markdown += `${note.contents}\n\n`;
            markdown += `---\n\n`;
        });
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importNotesFromMarkdown() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md';
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const imported = notesModule.parseNotesMarkdown(text);
            let count = 0;

            for (const [elementId, notesList] of Object.entries(imported)) {
                if (!notesById[elementId]) {
                    notesById[elementId] = [];
                }
                notesList.forEach((note) => {
                    const exists = notesById[elementId].some(
                        n => n.contents === note.contents && n.createdDate === note.createdDate
                    );
                    if (!exists) {
                        notesById[elementId].push(note);
                        count++;
                    }
                });
            }

            localStorage.setItem('notesById', JSON.stringify(notesById));
            notesModule.placeNoteToggles();
            alert(`Imported ${count} note(s).`);
        };
        reader.readAsText(file);
    });
    input.click();
  },

  parseNotesMarkdown(text) {
    const result = {};
    const sections = text.split(/^## /m).filter(s => s.trim());

    sections.forEach((section) => {
        const lines = section.split('\n');
        const elementId = lines[0].trim();
        if (!elementId) return;

        result[elementId] = [];

        const content = lines.slice(1).join('\n');
        const noteBlocks = content.split(/^---$/m);

        noteBlocks.forEach((block) => {
            const blockTrimmed = block.trim();
            if (!blockTrimmed) return;

            const dateMatch = blockTrimmed.match(/\*\*(.+?)\*\*/);
            const createdDate = dateMatch ? dateMatch[1] : '';

            const blockLines = blockTrimmed.split('\n').filter(l => l.trim());
            const contentLines = blockLines.filter(l => !l.startsWith('> ') && !l.match(/^\*\*.+\*\*$/));
            const noteContent = contentLines.join('\n').trim();

            if (noteContent) {
                result[elementId].push({
                    contents: noteContent,
                    createdDate: createdDate,
                    id: elementId
                });
            }
        });
    });

    return result;
  },

  async syncToFolder() {
    if (!('showDirectoryPicker' in window)) {
        alert('Your browser does not support folder sync. Try Chrome or Edge.');
        return;
    }

    try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        syncDirHandle = dirHandle;
        await saveDirHandle(dirHandle);
        updateSyncButton();

        for (const elementId of Object.keys(notesById)) {
            await notesModule.syncFileForElement(elementId);
        }

        alert(`Folder sync enabled. ${Object.keys(notesById).length} file(s) written. Notes will auto-save to this folder.`);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Folder sync error:', err);
            alert('Error syncing to folder.');
        }
    }
  },

  async disconnectFolder() {
    if (!confirm('Disconnect folder sync? Notes will no longer auto-save to the folder. Your existing notes in the browser and any files already written will not be deleted.')) {
        return;
    }
    syncDirHandle = null;
    await clearDirHandle();
    updateSyncButton();
  },

  placeNoteToggles() {
    Object.keys(notesById).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (!notes.elementAlreadyHasToggleBtn(element)) {
                notesModule.addEmojiAfterElement(element);
            }
        }
    });
  }
};

window.notes = notesModule;

// Event listener for the emoji button
document.addEventListener('click', (event) => {
    if (!notesEnabled) return;
    if (event.target.classList.contains('notes-toggle')) {
        notesModule.toggleNoteContent(event.target);
    }
});

function getFormattedDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function updateSyncButton() {
  const syncCard = document.getElementById('sync-folder-card');
  const syncStatus = document.getElementById('sync-status');
  if (!syncCard) return;

  if (syncDirHandle) {
    syncCard.style.display = 'none';
    if (syncStatus) {
      syncStatus.style.display = '';
      const folderNameEl = document.getElementById('sync-folder-name');
      if (folderNameEl) folderNameEl.textContent = syncDirHandle.name;
    }
  } else {
    syncCard.style.display = '';
    if (syncStatus) syncStatus.style.display = 'none';
  }
}

function checkForTestParameter() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('test') === 'true';
}
