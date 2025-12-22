// User view page logic for Christmas Bingo

// Initialize Supabase client
if (typeof supabase === 'undefined') {
    var supabase;
}
try {
    if (!supabase) {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    }
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    alert('Configuration error. Please contact the administrator.');
}

// Parse URL to get group name and username
function getPathInfo() {
    // First check if we have a redirect parameter (from 404 routing)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');

    const path = redirectPath || window.location.pathname;

    // Expected format: /christmas-bingo/[groupname]/[username]/view/
    const match = path.match(/\/christmas-bingo\/([^\/]+)\/([^\/]+)\/view/);
    if (match) {
        return {
            groupName: decodeURIComponent(match[1]),
            username: decodeURIComponent(match[2])
        };
    }
    return null;
}

// Initialize page
async function init() {
    const pathInfo = getPathInfo();

    if (!pathInfo) {
        showError('Invalid URL format');
        return;
    }

    const { groupName, username } = pathInfo;

    // Set up navigation links
    document.getElementById('backLink').href = `/christmas-bingo/${encodeURIComponent(groupName)}/`;
    document.getElementById('editButton').href = `/christmas-bingo/${encodeURIComponent(groupName)}/${encodeURIComponent(username)}/edit/`;

    // Set username
    document.getElementById('userName').textContent = username;

    try {
        // Fetch user data
        const { data: group } = await supabase
            .from('groups')
            .select('id')
            .eq('name', groupName)
            .single();

        if (!group) {
            showError('Group not found');
            return;
        }

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .eq('group_id', group.id)
            .single();

        if (!user) {
            showError('User not found. They may need to register first.');
            return;
        }

        // Fetch submissions
        const { data: submissions, error } = await supabase
            .from('bingo_submissions')
            .select('*')
            .eq('user_id', user.id)
            .order('square_index', { ascending: true });

        if (error) {
            console.error('Error fetching submissions:', error);
            showError('Failed to load submissions');
            return;
        }

        // Update count (only approved submissions)
        const approvedCount = submissions.filter(sub => sub.approval_status === 'approved').length;
        document.getElementById('completedCount').textContent = approvedCount;

        // Render submissions
        renderSubmissions(submissions);

    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

// Render submissions grid
function renderSubmissions(submissions) {
    const container = document.getElementById('submissionsContainer');

    // Filter out attestations - only show photos and videos
    const mediaSubmissions = submissions.filter(sub =>
        sub.submission_type !== 'attestation' && sub.file_url
    );

    if (mediaSubmissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No Tasks Completed Yet</h3>
                <p>Start completing tasks to see them here!</p>
            </div>
        `;
        return;
    }

    let html = '<div class="submissions-grid">';

    mediaSubmissions.forEach(submission => {
        const date = new Date(submission.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        html += `
            <div class="submission-card">
                <div class="submission-task">
                    <span class="task-number">#${submission.square_index + 1}</span>
                    <span>${escapeHtml(submission.square_text)}</span>
                </div>
        `;

        if (submission.submission_type === 'photo') {
            html += `
                <div class="submission-media">
                    <img src="${escapeHtml(submission.file_url)}"
                         alt="Submission"
                         onclick="openModal('image', '${escapeHtml(submission.file_url)}')">
                </div>
            `;
        } else if (submission.submission_type === 'video') {
            html += `
                <div class="submission-media">
                    <video src="${escapeHtml(submission.file_url)}"
                           onclick="openModal('video', '${escapeHtml(submission.file_url)}')">
                    </video>
                </div>
            `;
        }

        html += `
                <div class="submission-date">Completed ${date}</div>
                <button class="copy-link-button" onclick="copyToClipboard('${escapeHtml(submission.file_url)}', event)">
                    📋 Copy Link
                </button>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

// Modal functions
function openModal(type, url) {
    const modal = document.getElementById('mediaModal');
    const modalImage = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');

    if (type === 'image') {
        modalImage.src = url;
        modalImage.style.display = 'block';
        modalVideo.style.display = 'none';
    } else if (type === 'video') {
        modalVideo.src = url;
        modalVideo.style.display = 'block';
        modalImage.style.display = 'none';
    }

    modal.classList.add('show');
    event.stopPropagation();
}

function closeModal() {
    const modal = document.getElementById('mediaModal');
    const modalImage = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');

    modal.classList.remove('show');
    modalImage.src = '';
    modalVideo.src = '';
    modalVideo.pause();
}

// Show error
function showError(message) {
    const container = document.getElementById('submissionsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3>Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Copy to clipboard
function copyToClipboard(url, event) {
    event.stopPropagation();

    navigator.clipboard.writeText(url).then(() => {
        // Change button text temporarily
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '✓ Copied!';
        button.style.background = '#4caf50';

        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link. Please try again.');
    });
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
