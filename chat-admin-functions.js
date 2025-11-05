// Admin functions for chat moderation

// Show confirmation modal
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'alert-modal';
    modal.innerHTML = `
      <div class="alert-modal-content">
        <div class="alert-modal-icon warning">⚠</div>
        <div class="alert-modal-title">${escapeHtml(title)}</div>
        <div class="alert-modal-message">${escapeHtml(message)}</div>
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 24px;">
          <button class="alert-modal-button" onclick="confirmModalResult(false)" style="background: var(--chip);">ביטול</button>
          <button class="alert-modal-button error" onclick="confirmModalResult(true)">אישור</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    window.confirmModalResult = (result) => {
      closeConfirmModal();
      resolve(result);
    };
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.confirmModalResult(false);
      }
    });
  });
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  if (modal) {
    modal.remove();
    delete window.confirmModalResult;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function editMessage(messageId, currentMessage) {
  // Use a modal for editing instead of prompt
  const modal = document.createElement('div');
  modal.id = 'editMessageModal';
  modal.className = 'alert-modal';
  modal.setAttribute('data-original-message', currentMessage);
  modal.innerHTML = `
    <div class="alert-modal-content" style="max-width: 500px;">
      <div class="alert-modal-title">ערוך הודעה</div>
      <textarea id="editMessageText" style="width: 100%; min-height: 100px; padding: 12px; border-radius: 8px; border: 1px solid var(--chip); background: var(--panel); color: var(--text); font-family: inherit; font-size: 14px; margin: 16px 0; resize: vertical;">${escapeHtml(currentMessage)}</textarea>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button class="alert-modal-button" onclick="closeEditMessageModal()" style="background: var(--chip);">ביטול</button>
        <button class="alert-modal-button" onclick="saveEditedMessage('${messageId}')">שמור</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Focus on textarea
  setTimeout(() => {
    document.getElementById('editMessageText').focus();
  }, 100);
}

function closeEditMessageModal() {
  const modal = document.getElementById('editMessageModal');
  if (modal) {
    modal.remove();
  }
}

function saveEditedMessage(messageId) {
  const textarea = document.getElementById('editMessageText');
  const newMessage = textarea.value.trim();
  const modal = document.getElementById('editMessageModal');
  const originalMessage = modal.getAttribute('data-original-message') || '';
  
  if (!newMessage || newMessage === originalMessage) {
    closeEditMessageModal();
    return;
  }
  
  fetch(`${API_URL}/api/admin/chat/messages/${messageId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ message: newMessage })
  })
  .then(response => response.json())
  .then(data => {
    closeEditMessageModal();
    if (!data.success) {
      showModalAlert('שגיאה', 'שגיאה בעריכת ההודעה', 'error');
    } else {
      showModalAlert('הצלחה', 'ההודעה נערכה בהצלחה', 'success');
    }
  })
  .catch(error => {
    console.error('Error editing message:', error);
    closeEditMessageModal();
    showModalAlert('שגיאה', 'שגיאה בעריכת ההודעה', 'error');
  });
}

async function deleteMessage(messageId) {
  // Show confirmation modal
  if (!await showConfirmModal('מחיקת הודעה', 'האם אתה בטוח שברצונך למחוק את ההודעה?')) {
    return;
  }
  
  fetch(`${API_URL}/api/admin/chat/messages/${messageId}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  .then(response => response.json())
    .then(data => {
      if (!data.success) {
        showModalAlert('שגיאה', 'שגיאה במחיקת ההודעה', 'error');
      } else {
        showModalAlert('הצלחה', 'ההודעה נמחקה בהצלחה', 'success');
      }
    })
    .catch(error => {
      console.error('Error deleting message:', error);
      showModalAlert('שגיאה', 'שגיאה במחיקת ההודעה', 'error');
    });
}

function showUserActions(userId, username) {
  let modal = document.getElementById('userActionsModal');
  if (!modal) {
    createUserActionsModal();
    modal = document.getElementById('userActionsModal');
  }
  
  modal.setAttribute('data-user-id', userId);
  modal.querySelector('.modal-user-name').textContent = username;
  modal.style.display = 'flex';
}

function createUserActionsModal() {
  const modal = document.createElement('div');
  modal.id = 'userActionsModal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>פעולות משתמש: <span class="modal-user-name"></span></h3>
        <button class="modal-close" onclick="closeUserActionsModal()">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
      <div style="padding: 20px;">
        <div class="form-group">
          <label>השתקה (שעות)</label>
          <input type="number" id="muteDuration" min="1" placeholder="מספר שעות" />
          <button class="btn-submit" onclick="muteUser()" style="margin-top: 8px; width: 100%;">השתק</button>
        </div>
        <div class="form-group">
          <label>באן (שעות, ריק לצמיתות)</label>
          <input type="number" id="banDuration" min="1" placeholder="מספר שעות (ריק לצמיתות)" />
          <input type="text" id="banReason" placeholder="סיבה (אופציונלי)" style="margin-top: 8px;" />
          <button class="btn-submit" style="background: linear-gradient(180deg, #ff4d4f, #cc0000); margin-top: 8px; width: 100%;" onclick="banUser()">חסום</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function closeUserActionsModal() {
  const modal = document.getElementById('userActionsModal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('muteDuration').value = '';
    document.getElementById('banDuration').value = '';
    document.getElementById('banReason').value = '';
  }
}

function muteUser() {
  const modal = document.getElementById('userActionsModal');
  const userId = modal.getAttribute('data-user-id');
  const duration = parseInt(document.getElementById('muteDuration').value);
  
  if (!duration || duration < 1) {
    showModalAlert('שגיאה', 'נא להזין מספר שעות תקין', 'error');
    return;
  }
  
  fetch(`${API_URL}/api/admin/chat/mute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ userId, duration })
  })
  .then(response => response.json())
    .then(data => {
      if (data.success) {
        showModalAlert('הצלחה', 'המשתמש הושתק בהצלחה', 'success');
        closeUserActionsModal();
      } else {
        showModalAlert('שגיאה', 'שגיאה בהשתקת המשתמש', 'error');
      }
    })
    .catch(error => {
      console.error('Error muting user:', error);
      showModalAlert('שגיאה', 'שגיאה בהשתקת המשתמש', 'error');
    });
}

async function banUser() {
  const modal = document.getElementById('userActionsModal');
  const userId = modal.getAttribute('data-user-id');
  const durationInput = document.getElementById('banDuration').value;
  const duration = durationInput ? parseInt(durationInput) : null;
  const reason = document.getElementById('banReason').value || 'הורחק על ידי מנהל';
  
  // Show confirmation modal
  if (!await showConfirmModal('חסימת משתמש', 'האם אתה בטוח שברצונך לחסום את המשתמש?')) {
    return;
  }
  
  fetch(`${API_URL}/api/admin/chat/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',
    body: JSON.stringify({ userId, reason, duration })
  })
  .then(response => response.json())
    .then(data => {
      if (data.success) {
        showModalAlert('הצלחה', 'המשתמש נחסם בהצלחה', 'success');
        closeUserActionsModal();
      } else {
        showModalAlert('שגיאה', 'שגיאה בחסימת המשתמש', 'error');
      }
    })
    .catch(error => {
      console.error('Error banning user:', error);
      showModalAlert('שגיאה', 'שגיאה בחסימת המשתמש', 'error');
    });
}

function showBanNotice(reason, permanent) {
  const notice = document.createElement('div');
  notice.id = 'banNotice';
  notice.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    text-align: center;
    padding: 40px;
  `;
  notice.innerHTML = `
    <h1 style="font-size: 36px; margin-bottom: 20px; color: #ff4d4f;">הורחקת מהאתר</h1>
    <p style="font-size: 20px; margin-bottom: 30px;">${reason}</p>
    <p style="font-size: 16px; color: #aaa;">${permanent ? 'חסימה לצמיתות' : 'חסימה זמנית'}</p>
    <button onclick="window.location.href='/'" style="margin-top: 30px; padding: 12px 24px; background: #ff4d4f; color: #fff; border: 0; border-radius: 8px; cursor: pointer; font-size: 16px;">חזרה לדף הבית</button>
  `;
  document.body.appendChild(notice);
  
  // Redirect after 5 seconds
  setTimeout(() => {
    window.location.href = '/';
  }, 5000);
}

