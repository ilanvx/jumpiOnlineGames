// Chat functionality
// Determine API URL based on current host
const API_URL = (typeof window !== 'undefined' && (window.location.hostname === 'jumpigames.com' || window.location.hostname === 'www.jumpigames.com'))
  ? 'https://jumpigames.com' 
  : 'http://localhost:3000';
let socket = null;
let currentUser = null;
let currentRoomId = null;
let typingTimeout = null;
let typingUsers = new Map(); // userId -> username

// Initialize chat
function initChat() {
  // Get current user
  const userData = localStorage.getItem('jumpiUser');
  if (userData) {
    currentUser = JSON.parse(userData);
    
    // Show/hide create room button based on admin status
    const createRoomBtn = document.querySelector('.chat-add-room-btn');
    if (createRoomBtn) {
      if (currentUser.role === 'admin') {
        createRoomBtn.style.display = 'inline-flex';
      } else {
        createRoomBtn.style.display = 'none';
      }
    }
  }

  // Connect to Socket.IO
  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Connected to chat server');
  });

  socket.on('room-messages', (messages) => {
    displayMessages(messages);
  });

  socket.on('new-message', (message) => {
    if (message.roomId === currentRoomId) {
      addMessageToChat(message);
    }
  });

  socket.on('error', (error) => {
    console.error('Chat error:', error);
    if (error.message) {
      showModalAlert('שגיאה', error.message, 'error');
    }
  });

  socket.on('user-banned', (data) => {
    if (currentUser && (data.userId === currentUser.id || data.userId === currentUser._id)) {
      showBanNotice(data.reason, data.permanent);
    }
  });

  socket.on('user-muted', (data) => {
    if (currentUser && (data.userId === currentUser.id || data.userId === currentUser._id)) {
      const until = data.until ? new Date(data.until).toLocaleString('he-IL') : 'לצמיתות';
      showModalAlert('השתקה', `אתה מושתק עד ${until}`, 'warning');
      // Hide input if muted
      const chatInputContainer = document.getElementById('chatInputContainer');
      if (chatInputContainer) {
        chatInputContainer.style.display = 'none';
      }
    }
  });

  socket.on('message-deleted', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      messageElement.remove();
    }
  });

  socket.on('message-edited', (data) => {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
      const messageText = messageElement.querySelector('.chat-message-text');
      if (messageText) {
        messageText.textContent = data.message;
        if (data.edited) {
          messageText.classList.add('edited');
          const editedBadge = messageElement.querySelector('.edited-badge') || document.createElement('span');
          editedBadge.className = 'edited-badge';
          editedBadge.textContent = ' (נערך)';
          editedBadge.style.color = 'var(--muted)';
          editedBadge.style.fontSize = '12px';
          if (!messageText.querySelector('.edited-badge')) {
            messageText.appendChild(editedBadge);
          }
        }
      }
    }
  });

  socket.on('user-typing', (data) => {
    if (data.roomId !== currentRoomId) return;
    
    // Don't show current user's typing indicator
    const currentUserId = currentUser?.id || currentUser?._id;
    if (currentUserId && data.userId === currentUserId.toString()) {
      return;
    }
    
    if (data.typing) {
      typingUsers.set(data.userId.toString(), data.username);
    } else {
      typingUsers.delete(data.userId.toString());
    }
    
    updateTypingIndicator();
  });

  // Load rooms
  loadRooms();
}

// Toggle chat sidebar
function toggleChat() {
  const sidebar = document.getElementById('chatSidebar');
  if (sidebar.style.display === 'none') {
    sidebar.style.display = 'flex';
    if (!socket) {
      initChat();
    }
  } else {
    sidebar.style.display = 'none';
    if (currentRoomId) {
      socket.emit('leave-room', currentRoomId);
      currentRoomId = null;
    }
  }
}

// Load chat rooms
async function loadRooms() {
  try {
    const response = await fetch(`${API_URL}/api/chat/rooms`);
    if (response.ok) {
      const rooms = await response.json();
      displayRooms(rooms);
    }
  } catch (error) {
    console.error('Error loading rooms:', error);
  }
}

// Display rooms
function displayRooms(rooms) {
  const roomsList = document.getElementById('chatRoomsList');
  roomsList.innerHTML = '';

  if (rooms.length === 0) {
    roomsList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--muted); font-size: 14px;">אין חדרים זמינים</div>';
    return;
  }

  rooms.forEach(room => {
    const roomItem = document.createElement('div');
    roomItem.className = 'chat-room-item';
    roomItem.setAttribute('data-room-id', room._id);
    roomItem.onclick = () => joinRoom(room._id);
    roomItem.innerHTML = `
      <h5>${escapeHtml(room.name)}</h5>
      ${room.description ? `<p>${escapeHtml(room.description)}</p>` : ''}
    `;
    roomsList.appendChild(roomItem);
  });
}

// Join room
async function joinRoom(roomId) {
  if (currentRoomId === roomId) return;

  // Leave previous room
  if (currentRoomId) {
    socket.emit('leave-room', currentRoomId);
  }

  currentRoomId = roomId;
  
  // Update active room
  let currentRoomName = '';
  document.querySelectorAll('.chat-room-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-room-id') === roomId) {
      item.classList.add('active');
      currentRoomName = item.querySelector('h5')?.textContent || '';
    }
  });

  // Update chat header with room name
  if (currentRoomName) {
    const chatHeader = document.querySelector('.chat-header h3');
    if (chatHeader) {
      chatHeader.textContent = currentRoomName;
    }
  }

  // Clear typing users when switching rooms
  typingUsers.clear();
  updateTypingIndicator();
  
  // Join new room
  socket.emit('join-room', roomId);

  // Load room info and check if admin-only
  try {
    const roomsResponse = await fetch(`${API_URL}/api/chat/rooms`);
    if (roomsResponse.ok) {
      const rooms = await roomsResponse.json();
      const currentRoom = rooms.find(r => r._id === roomId);
      
      // Show/hide input based on room type and user role
      const chatInputContainer = document.getElementById('chatInputContainer');
      if (currentRoom && currentRoom.adminOnly && currentUser && currentUser.role !== 'admin') {
        chatInputContainer.style.display = 'none';
      } else {
        chatInputContainer.style.display = 'flex';
      }
    }
    
    const response = await fetch(`${API_URL}/api/chat/rooms/${roomId}/messages`);
    if (response.ok) {
      const messages = await response.json();
      displayMessages(messages);
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

// Display messages
function displayMessages(messages) {
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = '';

  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="chat-welcome">
        <i class="fa-solid fa-comments"></i>
        <p>אין הודעות עדיין. התחל את השיחה!</p>
      </div>
    `;
    return;
  }

  messages.forEach(message => {
    addMessageToChat(message);
  });

  scrollToBottom();
}

// Add message to chat
function addMessageToChat(message) {
  const messagesContainer = document.getElementById('chatMessages');
  
  // Remove welcome message if exists
  const welcome = messagesContainer.querySelector('.chat-welcome');
  if (welcome) {
    welcome.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = 'chat-message';
  
  const time = new Date(message.createdAt).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const adminBadge = message.isAdmin ? '<span class="chat-admin-badge" title="מנהל">👑</span>' : '';
  const editedBadge = message.edited ? '<span class="edited-badge" style="color: var(--muted); font-size: 12px;"> (נערך)</span>' : '';
  const adminActions = currentUser && currentUser.role === 'admin' ? `
    <div class="chat-message-actions">
      <button class="chat-action-btn" onclick="editMessage('${message._id}', '${escapeHtml(message.message)}')" title="ערוך">
        <i class="fa-solid fa-pencil"></i>
      </button>
      <button class="chat-action-btn" onclick="deleteMessage('${message._id}')" title="מחק">
        <i class="fa-solid fa-trash"></i>
      </button>
      <button class="chat-action-btn" onclick="showUserActions('${message.userId._id || message.userId}', '${escapeHtml(message.username)}')" title="פעולות משתמש">
        <i class="fa-solid fa-user-shield"></i>
      </button>
    </div>
  ` : '';
  
  messageDiv.setAttribute('data-message-id', message._id);
  messageDiv.className = 'chat-message';
  if (message.edited) {
    messageDiv.classList.add('edited');
  }
  
  messageDiv.innerHTML = `
    <img src="${getDefaultAvatar(message.username)}" alt="${escapeHtml(message.username)}" class="chat-message-avatar" data-user-picture="${escapeHtml(message.userPicture || '')}" data-username="${escapeHtml(message.username)}" />
    <div class="chat-message-content">
      <div class="chat-message-header">
        <span class="chat-message-username">${escapeHtml(message.username)}</span>
        ${adminBadge}
        <span class="chat-message-time">${time}</span>
        ${adminActions}
      </div>
      <div class="chat-message-text">${escapeHtml(message.message)}${editedBadge}</div>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  
  // Ensure avatar loads properly
  const avatarImg = messageDiv.querySelector('.chat-message-avatar');
  if (avatarImg) {
    const userPicture = avatarImg.getAttribute('data-user-picture');
    const username = avatarImg.getAttribute('data-username');
    ensureAvatarLoads(avatarImg, userPicture, username);
  }
  
  scrollToBottom();
}

// Send message
function sendChatMessage() {
  if (!currentRoomId || !currentUser) return;

  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) return;

  // Stop typing indicator
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  if (socket) {
    socket.emit('typing-stop', {
      roomId: currentRoomId,
      userId: currentUser.id || currentUser._id
    });
  }

  socket.emit('send-message', {
    roomId: currentRoomId,
    userId: currentUser.id || currentUser._id,
    username: currentUser.username || currentUser.name,
    userPicture: currentUser.picture,
    isAdmin: currentUser.role === 'admin',
    message: message
  });

  input.value = '';
}

// Handle typing indicator
function handleTyping() {
  if (!currentRoomId || !currentUser || !socket) return;
  
  // Clear existing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  // Emit typing start
  socket.emit('typing-start', {
    roomId: currentRoomId,
    userId: currentUser.id || currentUser._id,
    username: currentUser.username || currentUser.name
  });
  
  // Set timeout to stop typing after 3 seconds of inactivity
  typingTimeout = setTimeout(() => {
    socket.emit('typing-stop', {
      roomId: currentRoomId,
      userId: currentUser.id || currentUser._id
    });
  }, 3000);
}

function updateTypingIndicator() {
  const indicator = document.getElementById('chatTypingIndicator');
  const typingText = document.getElementById('typingText');
  
  if (!indicator || !typingText) return;
  
  // Remove current user from list
  const filteredUsers = Array.from(typingUsers.entries()).filter(
    ([userId]) => userId !== (currentUser?.id || currentUser?._id)
  );
  
  if (filteredUsers.length === 0) {
    indicator.style.display = 'none';
    return;
  }
  
  indicator.style.display = 'block';
  
  if (filteredUsers.length === 1) {
    typingText.textContent = `${filteredUsers[0][1]} מקליד...`;
  } else if (filteredUsers.length === 2) {
    typingText.textContent = `${filteredUsers[0][1]} ו-${filteredUsers[1][1]} מקלידים...`;
  } else {
    typingText.textContent = `${filteredUsers.length} אנשים מקלידים...`;
  }
}

// Send on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
        // Stop typing indicator
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
        if (socket && currentRoomId) {
          socket.emit('typing-stop', {
            roomId: currentRoomId,
            userId: currentUser?.id || currentUser?._id
          });
        }
      } else {
        handleTyping();
      }
    });
    
    // Also handle input for typing
    chatInput.addEventListener('input', () => {
      handleTyping();
    });
    
    // Stop typing when input loses focus
    chatInput.addEventListener('blur', () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      if (socket && currentRoomId) {
        socket.emit('typing-stop', {
          roomId: currentRoomId,
          userId: currentUser?.id || currentUser?._id
        });
      }
    });
  }
});

// Scroll to bottom
function scrollToBottom() {
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show create room modal
function showCreateRoomModal() {
  document.getElementById('createRoomModal').style.display = 'flex';
}

// Close create room modal
function closeCreateRoomModal() {
  document.getElementById('createRoomModal').style.display = 'none';
  document.getElementById('createRoomForm').reset();
}

// Create room
async function createRoom(event) {
  event.preventDefault();
  
  if (!currentUser) {
    showModalAlert('התחברות נדרשת', 'אתה צריך להתחבר כדי ליצור חדר', 'warning');
    return;
  }

  const name = document.getElementById('roomName').value.trim();
  const description = document.getElementById('roomDescription').value.trim();

  if (!name) return;

  try {
    const response = await fetch(`${API_URL}/api/chat/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        name: name,
        description: description
      })
    });

    if (response.ok) {
      const room = await response.json();
      closeCreateRoomModal();
      showModalAlert('הצלחה', 'החדר נוצר בהצלחה', 'success');
      loadRooms();
      // Auto-join the new room
      setTimeout(() => {
        joinRoom(room._id);
      }, 100);
    } else {
      showModalAlert('שגיאה', 'שגיאה ביצירת החדר', 'error');
    }
  } catch (error) {
    console.error('Error creating room:', error);
    showModalAlert('שגיאה', 'שגיאה ביצירת החדר', 'error');
  }
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get default avatar image (SVG data URI that always works)
function getDefaultAvatar(username) {
  // Create a simple SVG avatar with first letter of username
  const firstLetter = username ? username.charAt(0).toUpperCase() : '?';
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const colorIndex = username ? username.charCodeAt(0) % colors.length : 0;
  const bgColor = colors[colorIndex];
  
  const svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" fill="${bgColor}" rx="20"/>
    <text x="20" y="20" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${firstLetter}</text>
  </svg>`;
  
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

// Ensure avatar always loads
function ensureAvatarLoads(imgElement, userPicture, username) {
  if (!imgElement) return;
  
  const defaultAvatar = getDefaultAvatar(username);
  
  // Always set default first to ensure something is displayed
  imgElement.src = defaultAvatar;
  
  // Try to load user picture if available
  if (userPicture && userPicture.trim()) {
    const testImg = new Image();
    let loaded = false;
    
    testImg.onload = () => {
      loaded = true;
      // Only update if the element still exists and hasn't been changed
      if (imgElement && imgElement.parentNode) {
        imgElement.src = userPicture;
      }
    };
    
    testImg.onerror = () => {
      // Keep default avatar, don't change anything
      if (imgElement && imgElement.parentNode) {
        imgElement.src = defaultAvatar;
      }
    };
    
    testImg.src = userPicture;
    
    // Fallback: try direct assignment after a short delay
    setTimeout(() => {
      if (!loaded && imgElement && imgElement.parentNode) {
        // Try direct assignment
        const directImg = new Image();
        directImg.onload = () => {
          if (imgElement && imgElement.parentNode) {
            imgElement.src = userPicture;
          }
        };
        directImg.onerror = () => {
          // Keep default
          if (imgElement && imgElement.parentNode) {
            imgElement.src = defaultAvatar;
          }
        };
        directImg.src = userPicture;
      }
    }, 200);
  }
  
  // Final safety net: onerror handler on the actual element
  imgElement.onerror = function() {
    // If current src failed, use default
    if (this.src !== defaultAvatar) {
      this.src = defaultAvatar;
      this.onerror = null; // Prevent infinite loop
    }
  };
  
  // Preload default avatar to ensure it's always available
  const preloadImg = new Image();
  preloadImg.src = defaultAvatar;
}

// Show modal alert instead of browser alert
function showModalAlert(title, message, type = 'info') {
  // Remove existing alert modal if any
  const existing = document.getElementById('alertModal');
  if (existing) {
    existing.remove();
  }
  
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const modal = document.createElement('div');
  modal.id = 'alertModal';
  modal.className = 'alert-modal';
  modal.innerHTML = `
    <div class="alert-modal-content">
      <div class="alert-modal-icon ${type}">${icons[type] || icons.info}</div>
      <div class="alert-modal-title">${escapeHtml(title)}</div>
      <div class="alert-modal-message">${escapeHtml(message)}</div>
      <button class="alert-modal-button ${type === 'error' ? 'error' : ''}" onclick="closeModalAlert()">אישור</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModalAlert();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModalAlert();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function closeModalAlert() {
  const modal = document.getElementById('alertModal');
  if (modal) {
    modal.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      modal.remove();
    }, 200);
  }
}

// Initialize chat when user is logged in
document.addEventListener('DOMContentLoaded', () => {
  const userData = localStorage.getItem('jumpiUser');
  if (userData) {
    const user = JSON.parse(userData);
    if (user.registered && user.username) {
      // Chat will be initialized when opened
    }
  }
});

