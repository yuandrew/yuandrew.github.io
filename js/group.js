// Group page logic for Christmas Bingo

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showError('Configuration error. Please contact the administrator.');
}

// Store current group ID for activity feed
let currentGroupId = null;

// Parse group name from URL
function getGroupNameFromURL() {
    // First check if we have a redirect parameter (from 404 routing)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');

    const path = redirectPath || window.location.pathname;

    // Expected format: /christmas-bingo/[groupname]/ or /christmas-bingo/[groupname]
    const match = path.match(/\/christmas-bingo\/([^\/]+)/);
    const groupName = match ? decodeURIComponent(match[1]) : null;

    // Filter out non-group pages
    if (groupName && (groupName === 'index.html' || groupName === 'register.html' || groupName === 'register')) {
        return null;
    }

    return groupName;
}

// Main initialization
async function init() {
    const groupName = getGroupNameFromURL();

    if (!groupName || groupName === 'register.html' || groupName === 'register') {
        // If no group name or on register page, don't load group page
        return;
    }

    document.getElementById('groupNameDisplay').textContent = `Group: ${groupName}`;

    try {
        // Check if group exists
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('*')
            .eq('name', groupName)
            .single();

        if (groupError || !group) {
            showNotFound(groupName);
            return;
        }

        // Load leaderboard
        await loadLeaderboard(group.id, groupName);

    } catch (error) {
        console.error('Error loading group:', error);
        showError('Failed to load group data. Please try again.');
    }
}

// Load leaderboard data
async function loadLeaderboard(groupId, groupName) {
    // Store groupId globally for activity feed
    currentGroupId = groupId;

    try {
        // Fetch all users in this group with their submission counts
        const { data: users, error } = await supabase
            .from('users')
            .select(`
                id,
                username,
                created_at
            `)
            .eq('group_id', groupId)
            .order('username', { ascending: true });

        if (error) {
            console.error('Error fetching users:', error);
            showError('Failed to load leaderboard.');
            return;
        }

        // For each user, count their approved submissions only
        const usersWithScores = await Promise.all(
            users.map(async (user) => {
                const { count, error: countError } = await supabase
                    .from('bingo_submissions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('approval_status', 'approved');

                return {
                    ...user,
                    score: countError ? 0 : count
                };
            })
        );

        // Sort by score (descending)
        usersWithScores.sort((a, b) => b.score - a.score);

        // Render leaderboard
        renderLeaderboard(usersWithScores, groupName);

    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showError('Failed to load leaderboard.');
    }
}

// Load activity feed - last 20 approved submissions across all group users
async function loadActivityFeed(groupId, groupName) {
    const container = document.getElementById('activityFeedContainer');

    if (!container) return; // Guard clause if element doesn't exist

    try {
        // Fetch last 20 approved submissions with user information
        const { data: submissions, error } = await supabase
            .from('bingo_submissions')
            .select(`
                id,
                square_index,
                square_text,
                submission_type,
                file_url,
                created_at,
                users!inner (
                    username,
                    group_id
                )
            `)
            .eq('users.group_id', groupId)
            .eq('approval_status', 'approved')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching activity feed:', error);
            container.innerHTML = `
                <div class="activity-empty-state">
                    <div class="activity-empty-state-icon">⚠️</div>
                    <p>Failed to load activity feed</p>
                </div>
            `;
            return;
        }

        renderActivityFeed(submissions, groupName);

    } catch (error) {
        console.error('Error loading activity feed:', error);
        container.innerHTML = `
            <div class="activity-empty-state">
                <div class="activity-empty-state-icon">⚠️</div>
                <p>Failed to load activity feed</p>
            </div>
        `;
    }
}

// Render activity feed items
function renderActivityFeed(submissions, groupName) {
    const container = document.getElementById('activityFeedContainer');

    if (!submissions || submissions.length === 0) {
        container.innerHTML = `
            <div class="activity-empty-state">
                <div class="activity-empty-state-icon">📭</div>
                <p>No submissions yet. Be the first to complete a task!</p>
            </div>
        `;
        return;
    }

    let html = '';

    submissions.forEach(submission => {
        const username = submission.users.username;
        const timeAgo = formatTimeAgo(submission.created_at);
        const submissionType = submission.submission_type;

        // Determine click handler based on submission type
        let clickHandler = '';
        if (submissionType === 'attestation') {
            // Navigate to user profile for attestations
            clickHandler = `onclick="goToUserView('${groupName}', '${escapeHtml(username)}')"`;
        } else if (submission.file_url) {
            // Open modal for photos and videos
            clickHandler = `onclick="openActivityModal('${submissionType}', '${escapeHtml(submission.file_url)}', event)"`;
        }

        html += `
            <div class="activity-feed-item" ${clickHandler}>
        `;

        // Thumbnail
        if (submissionType === 'photo' && submission.file_url) {
            html += `
                <img src="${escapeHtml(submission.file_url)}"
                     class="activity-thumbnail"
                     alt="Submission thumbnail"
                     loading="lazy">
            `;
        } else if (submissionType === 'video' && submission.file_url) {
            html += `
                <video src="${escapeHtml(submission.file_url)}"
                       class="activity-thumbnail"
                       preload="metadata"></video>
            `;
        } else {
            // Attestation - show checkmark icon
            html += `
                <div class="activity-thumbnail attestation">✓</div>
            `;
        }

        // Content
        html += `
            <div class="activity-content">
                <div class="activity-header">
                    <span class="activity-username">${escapeHtml(username)}</span>
                    <span class="activity-time">${timeAgo}</span>
                </div>
                <div class="activity-task">
                    <span class="activity-task-number">#${submission.square_index + 1}</span>
                    ${truncateText(escapeHtml(submission.square_text), 60)}
                </div>
                <span class="activity-type-badge ${submissionType}">
                    ${getTypeIcon(submissionType)} ${capitalizeFirst(submissionType)}
                </span>
            </div>
        `;

        html += '</div>';
    });

    container.innerHTML = html;
}

// Render leaderboard UI
function renderLeaderboard(users, groupName) {
    const content = document.getElementById('mainContent');

    if (users.length === 0) {
        content.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <h2>No Players Yet</h2>
                <p>Be the first to join this Christmas Bingo group!</p>
            </div>
            <div class="register-section">
                <h3>Join the Fun!</h3>
                <p style="margin: 15px 0; color: #666;">Register to start playing</p>
                <button onclick="showRegisterForm()" class="button">Register Now</button>
            </div>
        `;
        return;
    }

    let leaderboardHTML = '<h2>🏆 Top 5 Leaderboard</h2><div class="leaderboard-container">';

    // Only show top 5 users
    const displayUsers = users.slice(0, 5);

    displayUsers.forEach((user, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

        leaderboardHTML += `
            <div class="leaderboard-item" onclick="goToUserView('${groupName}', '${user.username}')">
                <div class="user-info">
                    <div class="rank">${medal || rank}</div>
                    <div class="username">${escapeHtml(user.username)}</div>
                </div>
                <div class="score">${user.score} / 25</div>
            </div>
        `;
    });

    leaderboardHTML += '</div>';

    // Add activity feed section
    leaderboardHTML += `
        <div class="activity-feed-section">
            <h2>📰 Recent Activity</h2>
            <div id="activityFeedContainer" class="activity-feed-container">
                <div class="loading-spinner" style="padding: 20px;">
                    Loading recent activity...
                </div>
            </div>
        </div>
    `;

    leaderboardHTML += `
        <div class="register-section">
            <h3>Want to Join?</h3>
            <p style="margin: 15px 0; color: #666;">Register to start playing</p>
            <button onclick="showRegisterForm()" class="button">Register Now</button>
            <p style="margin-top: 20px;">
                <a href="/christmas-bingo/${encodeURIComponent(groupName)}/admin/" style="color: #667eea; text-decoration: none; font-size: 0.9em;">
                    🔒 Admin Panel
                </a>
            </p>
        </div>
    `;

    content.innerHTML = leaderboardHTML;

    // Load activity feed after rendering
    loadActivityFeed(currentGroupId, groupName);
}

// Show registration form
function showRegisterForm() {
    const groupName = getGroupNameFromURL();
    const content = document.getElementById('mainContent');

    content.innerHTML = `
        <h2>Register to Play</h2>
        <p style="margin-bottom: 20px; color: #666;">Choose a username to join the group</p>

        <div id="registerError" class="error-message"></div>
        <div id="registerSuccess" class="success-message"></div>

        <form id="userRegisterForm" onsubmit="handleUserRegistration(event)">
            <div class="form-group">
                <label for="username">Username</label>
                <input
                    type="text"
                    id="username"
                    name="username"
                    placeholder="Enter your username"
                    required
                    pattern="[a-zA-Z0-9_-]+"
                    title="Only letters, numbers, hyphens, and underscores allowed"
                    minlength="2"
                    maxlength="20"
                >
            </div>

            <button type="submit" class="button" id="registerSubmitButton">
                Register
            </button>
        </form>

        <div style="margin-top: 20px; text-align: center;">
            <a href="#" onclick="init(); return false;" class="button-secondary">Back to Leaderboard</a>
        </div>
    `;
}

// Handle user registration
async function handleUserRegistration(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const groupName = getGroupNameFromURL();
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    const submitButton = document.getElementById('registerSubmitButton');

    // Clear previous messages
    errorDiv.classList.remove('show');
    successDiv.classList.remove('show');

    // Disable form
    submitButton.disabled = true;
    submitButton.textContent = 'Registering...';

    try {
        // Get group ID
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('id')
            .eq('name', groupName)
            .single();

        if (groupError || !group) {
            throw new Error('Group not found');
        }

        // Create user
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert([{
                username: username,
                group_id: group.id
            }])
            .select()
            .single();

        if (userError) {
            if (userError.code === '23505') { // Unique violation
                errorDiv.textContent = 'This username is already taken in this group. Please choose another one.';
                errorDiv.classList.add('show');
            } else {
                console.error('Error creating user:', userError);
                errorDiv.textContent = 'Failed to register. Please try again.';
                errorDiv.classList.add('show');
            }
            submitButton.disabled = false;
            submitButton.textContent = 'Register';
            return;
        }

        // Success! Redirect to user's view page
        successDiv.textContent = 'Registration successful! Redirecting...';
        successDiv.classList.add('show');

        setTimeout(() => {
            window.location.href = `/christmas-bingo/${encodeURIComponent(groupName)}/${encodeURIComponent(username)}/view/`;
        }, 1500);

    } catch (error) {
        console.error('Error during registration:', error);
        errorDiv.textContent = 'An unexpected error occurred. Please try again.';
        errorDiv.classList.add('show');
        submitButton.disabled = false;
        submitButton.textContent = 'Register';
    }
}

// Navigate to user view
function goToUserView(groupName, username) {
    window.location.href = `/christmas-bingo/${encodeURIComponent(groupName)}/${encodeURIComponent(username)}/view/`;
}

// Format time ago (X minutes/hours/days ago)
function formatTimeAgo(timestamp) {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return 'Just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
        // Show date for older entries
        return then.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}

// Get icon for submission type
function getTypeIcon(type) {
    const icons = {
        photo: '📷',
        video: '🎥',
        attestation: '✓'
    };
    return icons[type] || '📝';
}

// Capitalize first letter
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Open modal for activity feed media
function openActivityModal(type, url, event) {
    event.stopPropagation(); // Prevent event bubbling

    const modal = document.getElementById('activityMediaModal');
    const modalImage = document.getElementById('activityModalImage');
    const modalVideo = document.getElementById('activityModalVideo');

    if (type === 'photo') {
        modalImage.src = url;
        modalImage.style.display = 'block';
        modalVideo.style.display = 'none';
        modalVideo.pause();
    } else if (type === 'video') {
        modalVideo.src = url;
        modalVideo.style.display = 'block';
        modalImage.style.display = 'none';
    }

    modal.classList.add('show');
}

// Close activity feed modal
function closeActivityModal() {
    const modal = document.getElementById('activityMediaModal');
    const modalImage = document.getElementById('activityModalImage');
    const modalVideo = document.getElementById('activityModalVideo');

    modal.classList.remove('show');
    modalImage.src = '';
    modalVideo.src = '';
    modalVideo.pause();
}

// Close modal on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeActivityModal();
    }
});

// Show error message
function showError(message) {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <div class="error-box">
            <h2>⚠️ Error</h2>
            <p>${escapeHtml(message)}</p>
            <button onclick="location.reload()" class="button" style="margin-top: 20px;">
                Retry
            </button>
        </div>
    `;
}

// Show not found message
function showNotFound(groupName) {
    const content = document.getElementById('mainContent');
    content.innerHTML = `
        <div class="not-found">
            <h2>❌ Group Not Found</h2>
            <p style="margin-bottom: 30px; color: #666;">
                The group "${escapeHtml(groupName)}" does not exist.
            </p>
            <a href="/christmas-bingo/register.html" class="button">
                Create a New Group
            </a>
        </div>
    `;
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
