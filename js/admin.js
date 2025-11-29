// Admin panel logic for Christmas Bingo

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    alert('Configuration error. Please contact the administrator.');
}

const ADMIN_PASSWORD = 'picklemuffins';
let currentGroupName = null;
let currentGroupId = null;
let allSubmissions = [];
let currentFilter = 'pending';

// Parse URL to get group name
function getGroupNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');
    const path = redirectPath || window.location.pathname;

    const match = path.match(/\/christmas-bingo\/([^\/]+)\/admin/);
    return match ? match[1] : null;
}

// Initialize page
async function init() {
    currentGroupName = getGroupNameFromURL();

    if (!currentGroupName) {
        showError('Invalid URL format');
        return;
    }

    // Set up back links
    document.getElementById('backLink').href = `/christmas-bingo/${currentGroupName}/`;
    document.getElementById('backToGroupLink').href = `/christmas-bingo/${currentGroupName}/`;

    // Check if already authenticated
    const isAuthenticated = sessionStorage.getItem(`admin_auth_${currentGroupName}`) === 'true';

    if (isAuthenticated) {
        await showAdminPanel();
    } else {
        showAuthSection();
    }
}

// Show authentication section
function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';

    const form = document.getElementById('authForm');
    form.addEventListener('submit', handleAuth);
}

// Handle authentication
function handleAuth(event) {
    event.preventDefault();

    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('authError');

    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem(`admin_auth_${currentGroupName}`, 'true');
        showAdminPanel();
    } else {
        errorDiv.textContent = 'Incorrect password. Please try again.';
        errorDiv.classList.add('show');
    }
}

// Show admin panel
async function showAdminPanel() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    document.getElementById('groupNameDisplay').textContent = `Group: ${currentGroupName}`;

    try {
        // Get group ID
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('id')
            .eq('name', currentGroupName)
            .single();

        if (groupError || !group) {
            showError('Group not found');
            return;
        }

        currentGroupId = group.id;

        // Load all challenge submissions
        await loadSubmissions();
    } catch (error) {
        console.error('Error loading admin panel:', error);
        showError('Failed to load submissions');
    }
}

// Load submissions
async function loadSubmissions() {
    try {
        // Get all challenge submissions for this group
        const { data: submissions, error } = await supabase
            .from('bingo_submissions')
            .select(`
                *,
                users!inner (
                    username,
                    group_id
                )
            `)
            .eq('is_challenge', true)
            .eq('users.group_id', currentGroupId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allSubmissions = submissions;
        renderSubmissions();
    } catch (error) {
        console.error('Error loading submissions:', error);
        showError('Failed to load submissions');
    }
}

// Filter submissions
function filterSubmissions(filter) {
    currentFilter = filter;

    // Update tab styles
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');

    renderSubmissions();
}

// Render submissions
function renderSubmissions() {
    const container = document.getElementById('submissionsContainer');

    let filteredSubmissions = allSubmissions;

    if (currentFilter !== 'all') {
        filteredSubmissions = allSubmissions.filter(sub => sub.approval_status === currentFilter);
    }

    if (filteredSubmissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No ${currentFilter} challenge submissions</h3>
                <p>Challenge submissions will appear here once users submit them.</p>
            </div>
        `;
        return;
    }

    let html = '';

    filteredSubmissions.forEach(submission => {
        const statusClass = `status-${submission.approval_status}`;
        const date = new Date(submission.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        html += `
            <div class="submission-card">
                <div class="submission-header">
                    <div class="user-info">
                        👤 ${escapeHtml(submission.users.username)}
                    </div>
                    <div class="status-badge ${statusClass}">
                        ${submission.approval_status.toUpperCase()}
                    </div>
                </div>

                <div class="task-info">
                    <span class="task-number">Task #${submission.square_index + 1}</span>
                    <span>${escapeHtml(submission.square_text)}</span>
                </div>

                <p style="color: #999; font-size: 0.9em; margin: 10px 0;">
                    Submitted on ${date}
                </p>
        `;

        if (submission.file_url) {
            if (submission.submission_type === 'photo') {
                html += `
                    <div class="media-preview">
                        <img src="${escapeHtml(submission.file_url)}" alt="Submission">
                    </div>
                `;
            } else if (submission.submission_type === 'video') {
                html += `
                    <div class="media-preview">
                        <video src="${escapeHtml(submission.file_url)}" controls></video>
                    </div>
                `;
            }
        }

        if (submission.approval_status === 'pending') {
            html += `
                <div class="actions">
                    <button class="btn btn-approve" onclick="approveSubmission('${submission.id}')">
                        ✓ Approve
                    </button>
                    <button class="btn btn-reject" onclick="rejectSubmission('${submission.id}')">
                        ✗ Reject
                    </button>
                </div>
            `;
        } else if (submission.approval_status === 'approved') {
            html += `
                <div class="actions">
                    <button class="btn btn-reject" onclick="rejectSubmission('${submission.id}')">
                        Revoke Approval
                    </button>
                </div>
            `;
        } else if (submission.approval_status === 'rejected') {
            html += `
                <div class="actions">
                    <button class="btn btn-approve" onclick="approveSubmission('${submission.id}')">
                        Approve Anyway
                    </button>
                </div>
            `;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// Approve submission
async function approveSubmission(submissionId) {
    try {
        const { error } = await supabase
            .from('bingo_submissions')
            .update({
                approval_status: 'approved',
                approved_by: 'admin',
                approved_at: new Date().toISOString()
            })
            .eq('id', submissionId);

        if (error) throw error;

        // Reload submissions
        await loadSubmissions();

        alert('Challenge approved successfully!');
    } catch (error) {
        console.error('Error approving submission:', error);
        alert('Failed to approve submission. Please try again.');
    }
}

// Reject submission
async function rejectSubmission(submissionId) {
    if (!confirm('Are you sure you want to reject this challenge submission?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('bingo_submissions')
            .update({
                approval_status: 'rejected',
                approved_by: 'admin',
                approved_at: new Date().toISOString()
            })
            .eq('id', submissionId);

        if (error) throw error;

        // Reload submissions
        await loadSubmissions();

        alert('Challenge rejected.');
    } catch (error) {
        console.error('Error rejecting submission:', error);
        alert('Failed to reject submission. Please try again.');
    }
}

// Show error
function showError(message) {
    const container = document.getElementById('submissionsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <h3>⚠️ Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
