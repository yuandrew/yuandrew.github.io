// User edit page logic for Christmas Bingo

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    alert('Configuration error. Please contact the administrator.');
}

// Define the 25 bingo tasks
const BINGO_TASKS = [
    { text: "send a picture with you family", type: "photo", isChallenge: false },
    { text: "send a video of you saying something you're thankful for in 2025", type: "video", isChallenge: false },
    { text: "cook your family a meal and record their review", type: "video", isChallenge: false },
    { text: "record yourself calling a friend and telling them you love them", type: "video", isChallenge: false },
    { text: "hold a plank for one full worship song (NO BREAKS)", type: "video", isChallenge: false },
    { text: "record yourself giving someone a present and them opening it", type: "video", isChallenge: false },
    { text: "volunteer somewhere", type: "photo", isChallenge: false },
    { text: "CHALLENGE: Bake the biggest Christmas-shaped cookie (Only 3 biggest cookies can X this square)", type: "photo", isChallenge: true },
    { text: "Do a dramatic reading of Luke 2:1–20", type: "video", isChallenge: false },
    { text: "read a book and add a summary", type: "attestation", isChallenge: false, requiresText: true, minWords: 100 },
    { text: "chug a sparkling water without burping (record whole thing or no credit.)", type: "video", isChallenge: false },
    { text: "CHALLENGE: wrap a gift with oven mitts on (only fastest person can X)", type: "video", isChallenge: true },
    { text: "attend church :)", type: "attestation", isChallenge: false },
    { text: "record yourself doing 25 push ups in a row with Christmas decor behind you 🎄", type: "video", isChallenge: false },
    { text: "go to a Christmas market", type: "photo", isChallenge: false },
    { text: "build a Christmas tree out of objects that aren't a tree", type: "photo", isChallenge: false },
    { text: "make a gingerbread house", type: "photo", isChallenge: false },
    { text: "make a cup of hot cocoa for someone else and record you giving it to them", type: "video", isChallenge: false },
    { text: "take a photo with Santa or a reindeer", type: "photo", isChallenge: false },
    { text: "decorate a Christmas tree and photo with your favorite ornament", type: "photo", isChallenge: false },
    { text: "record yourself singing a Christmas song", type: "video", isChallenge: false },
    { text: "reenact the birth of Jesus using sock puppets", type: "video", isChallenge: false },
    { text: "make a snowman - upload a picture", type: "photo", isChallenge: false },
    { text: "take a photo in Christmas attire (pjs, Santa hat, ugly sweater)", type: "photo", isChallenge: false },
    { text: "CHALLENGE: pose with the coolest Christmas lights (Only top three coolest can X this square)", type: "photo", isChallenge: true }
];

const STORAGE_BUCKET = 'bingo-uploads';

let currentUser = null;
let currentGroupName = null;
let currentUsername = null;
let submissions = [];
let currentTaskIndex = null;
let currentFile = null;

// Parse URL to get group name and username
function getPathInfo() {
    // First check if we have a redirect parameter (from 404 routing)
    const urlParams = new URLSearchParams(window.location.search);
    const redirectPath = urlParams.get('redirect');

    const path = redirectPath || window.location.pathname;

    // Expected format: /christmas-bingo/[groupname]/[username]/edit/
    const match = path.match(/\/christmas-bingo\/([^\/]+)\/([^\/]+)\/edit/);
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

    currentGroupName = pathInfo.groupName;
    currentUsername = pathInfo.username;

    // Set up navigation links
    document.getElementById('backLink').href = `/christmas-bingo/${encodeURIComponent(currentGroupName)}/${encodeURIComponent(currentUsername)}/view/`;

    // Set username
    document.getElementById('userName').textContent = currentUsername;

    try {
        // Fetch user data
        const { data: group } = await supabase
            .from('groups')
            .select('id')
            .eq('name', currentGroupName)
            .single();

        if (!group) {
            showError('Group not found');
            return;
        }

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('username', currentUsername)
            .eq('group_id', group.id)
            .single();

        if (!user) {
            showError('User not found');
            return;
        }

        currentUser = user;

        // Fetch submissions
        await loadSubmissions();

        // Render board
        renderBingoBoard();
        updateProgress();

    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

// Load submissions
async function loadSubmissions() {
    const { data: userSubmissions, error } = await supabase
        .from('bingo_submissions')
        .select('*')
        .eq('user_id', currentUser.id);

    if (error) {
        console.error('Error fetching submissions:', error);
        throw error;
    }

    submissions = userSubmissions;
}

// Render the bingo board
function renderBingoBoard() {
    const board = document.getElementById('bingoBoard');

    // Create a map of submissions (approved and pending)
    const submissionMap = {};
    submissions.forEach(sub => {
        submissionMap[sub.square_index] = sub;
    });

    let html = '<div class="bingo-board">';

    BINGO_TASKS.forEach((task, index) => {
        const submission = submissionMap[index];
        let squareClass = 'bingo-square';

        if (submission) {
            if (submission.approval_status === 'approved') {
                squareClass = 'bingo-square completed';
            } else if (submission.approval_status === 'pending') {
                squareClass = 'bingo-square pending';
            } else if (submission.approval_status === 'rejected') {
                squareClass = 'bingo-square rejected';
            }
        }

        html += `
            <div class="${squareClass}" onclick="handleSquareClick(${index})">
                <div class="square-number">${index + 1}</div>
                ${task.isChallenge ? '<div class="challenge-badge">⭐</div>' : ''}
                ${submission && submission.approval_status === 'pending' ? '<div class="pending-badge">⏳</div>' : ''}
                <div class="square-content">
                    ${escapeHtml(task.text)}
                </div>
            </div>
        `;
    });

    html += '</div>';
    board.innerHTML = html;
}

// Update progress bar
function updateProgress() {
    // Only count approved submissions
    const completed = submissions.filter(sub => sub.approval_status === 'approved').length;
    const total = 25;
    const percentage = (completed / total) * 100;

    document.getElementById('progressBar').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${completed} / ${total}`;
}

// Handle square click
function handleSquareClick(index) {
    currentTaskIndex = index;
    const task = BINGO_TASKS[index];
    const submission = submissions.find(sub => sub.square_index === index);

    openTaskModal(task, index, submission);
}

// Open task modal
function openTaskModal(task, index, submission) {
    const modal = document.getElementById('taskModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalTaskText = document.getElementById('modalTaskText');
    const modalTaskType = document.getElementById('modalTaskType');
    const modalContent = document.getElementById('modalContent');

    // Set title and task text
    modalTitle.textContent = `Task #${index + 1}`;
    modalTaskText.textContent = task.text;

    // Set task type badge
    modalTaskType.textContent = task.type.toUpperCase();
    modalTaskType.className = `task-type-badge ${task.type}`;

    // Build modal content based on task type and submission status
    let content = '';

    if (submission) {
        // Task is already completed
        content = buildExistingSubmissionContent(task, submission);
    } else {
        // Task is not completed yet
        content = buildNewSubmissionContent(task, index);
    }

    modalContent.innerHTML = content;

    // Show modal
    modal.classList.add('show');
}

// Build content for existing submission
function buildExistingSubmissionContent(task, submission) {
    let content = `
        <div class="submission-info">
            <div class="submission-info-header">
                ✓ Task Completed
            </div>
            <div>Submitted on ${new Date(submission.created_at).toLocaleDateString()}</div>
        </div>
    `;

    if (task.type === 'attestation') {
        // Check if this is the book summary task with text
        if (task.requiresText && submission.file_url) {
            content += `
                <div class="attestation-section">
                    <h3 style="margin-bottom: 10px;">Your Book Summary:</h3>
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 8px; white-space: pre-wrap; line-height: 1.6;">
                        ${escapeHtml(submission.file_url)}
                    </div>
                </div>
            `;
        } else {
            content += `
                <div class="attestation-section">
                    <div class="attestation-checkbox">
                        <input type="checkbox" checked disabled>
                        <span>I have completed this task</span>
                    </div>
                </div>
            `;
        }
    } else if (submission.file_url) {
        // Show preview of uploaded file
        if (task.type === 'photo') {
            content += `
                <div class="preview-section">
                    <h3>Your Submission:</h3>
                    <img src="${escapeHtml(submission.file_url)}" class="preview-media" alt="Submission">
                </div>
            `;
        } else if (task.type === 'video') {
            content += `
                <div class="preview-section">
                    <h3>Your Submission:</h3>
                    <video src="${escapeHtml(submission.file_url)}" class="preview-media" controls></video>
                </div>
            `;
        }
    }

    // Add copy link button for media submissions (but not for book summary text)
    if (submission.file_url && task.type !== 'attestation') {
        content += `
            <div style="margin: 15px 0;">
                <button class="btn-secondary" onclick="copySubmissionLink('${escapeHtml(submission.file_url)}')" style="width: 100%;">
                    📋 Copy Link to Share
                </button>
            </div>
        `;
    }

    // Add update/remove buttons
    content += `
        <div class="modal-actions">
            <button class="btn-danger" onclick="removeSubmission(${submission.id})">
                Remove Submission
            </button>
            ${task.type !== 'attestation' ? `
                <button class="btn-secondary" onclick="enableUpdateMode()">
                    Update File
                </button>
            ` : ''}
            <button class="btn-primary" onclick="closeTaskModal()">
                Close
            </button>
        </div>
    `;

    return content;
}

// Build content for new submission
function buildNewSubmissionContent(task, index) {
    let content = '';

    if (task.type === 'attestation') {
        if (task.requiresText) {
            // Special handling for book summary task
            content += `
                <div class="attestation-section">
                    <label for="bookSummary" style="display: block; margin-bottom: 10px; font-weight: bold;">
                        Book Summary (minimum ${task.minWords} words):
                    </label>
                    <textarea
                        id="bookSummary"
                        placeholder="Enter your book summary here..."
                        style="width: 100%; min-height: 200px; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; line-height: 1.5; resize: vertical;"
                        oninput="updateWordCount()"></textarea>
                    <div id="wordCount" style="margin-top: 8px; color: #999; font-size: 0.9em;">0 words</div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeTaskModal()">Cancel</button>
                    <button class="btn-primary" id="submitAttestationBtn" onclick="submitAttestation()" disabled>Submit</button>
                </div>
            `;
        } else {
            content += `
                <div class="attestation-section">
                    <div class="attestation-checkbox">
                        <input type="checkbox" id="attestationCheckbox">
                        <label for="attestationCheckbox">I have completed this task</label>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="closeTaskModal()">Cancel</button>
                    <button class="btn-primary" onclick="submitAttestation()">Submit</button>
                </div>
            `;
        }
    } else {
        // Photo or video upload
        const acceptType = task.type === 'photo' ? 'image/*' : 'video/*';
        const fileIcon = task.type === 'photo' ? '📷' : '🎥';

        content += `
            <div class="upload-section" id="uploadSection" onclick="document.getElementById('fileInput').click()">
                <div id="uploadPrompt">
                    <div style="font-size: 3em; margin-bottom: 15px;">${fileIcon}</div>
                    <p>Tap to ${task.type === 'video' ? 'record or upload' : 'take or upload'} a ${task.type}</p>
                    <input type="file" id="fileInput" accept="${acceptType}" onchange="handleFileSelect(event)" style="position: absolute; left: -9999px;">
                    <button type="button" class="upload-button" onclick="event.stopPropagation(); document.getElementById('fileInput').click();">
                        ${task.type === 'video' ? '🎥 Choose/Record Video' : '📷 Choose/Take Photo'}
                    </button>
                </div>
                <div id="filePreview" style="display: none;">
                    <div id="previewContainer"></div>
                    <p id="fileName" style="margin-top: 15px; font-weight: bold;"></p>
                    <button class="btn-secondary" onclick="clearFileSelection()" style="margin-top: 10px;">
                        Choose Different File
                    </button>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeTaskModal()">Cancel</button>
                <button class="btn-primary" id="submitButton" onclick="submitUpload()" disabled>
                    Upload & Submit
                </button>
            </div>
        `;
    }

    return content;
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    currentFile = file;

    // Show preview
    const uploadPrompt = document.getElementById('uploadPrompt');
    const filePreview = document.getElementById('filePreview');
    const previewContainer = document.getElementById('previewContainer');
    const fileName = document.getElementById('fileName');
    const submitButton = document.getElementById('submitButton');

    uploadPrompt.style.display = 'none';
    filePreview.style.display = 'block';
    fileName.textContent = file.name;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const task = BINGO_TASKS[currentTaskIndex];
        if (task.type === 'photo') {
            previewContainer.innerHTML = `<img src="${e.target.result}" class="preview-media">`;
        } else if (task.type === 'video') {
            previewContainer.innerHTML = `<video src="${e.target.result}" class="preview-media" controls></video>`;
        }
    };
    reader.readAsDataURL(file);

    // Enable submit button
    submitButton.disabled = false;
}

// Clear file selection
function clearFileSelection() {
    currentFile = null;
    const uploadPrompt = document.getElementById('uploadPrompt');
    const filePreview = document.getElementById('filePreview');
    const submitButton = document.getElementById('submitButton');
    const fileInput = document.getElementById('fileInput');

    uploadPrompt.style.display = 'block';
    filePreview.style.display = 'none';
    fileInput.value = '';
    submitButton.disabled = true;
}

// Update word count for book summary
function updateWordCount() {
    const textarea = document.getElementById('bookSummary');
    const wordCountDiv = document.getElementById('wordCount');
    const submitBtn = document.getElementById('submitAttestationBtn');
    const task = BINGO_TASKS[currentTaskIndex];

    if (!textarea || !task.requiresText) return;

    const text = textarea.value.trim();
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    wordCountDiv.textContent = `${wordCount} words`;

    if (wordCount >= task.minWords) {
        wordCountDiv.style.color = '#4caf50';
        if (submitBtn) submitBtn.disabled = false;
    } else {
        wordCountDiv.style.color = '#999';
        if (submitBtn) submitBtn.disabled = true;
    }
}

// Submit attestation
async function submitAttestation() {
    const task = BINGO_TASKS[currentTaskIndex];

    // Check if this task requires text input (book summary)
    if (task.requiresText) {
        const textarea = document.getElementById('bookSummary');
        const text = textarea.value.trim();
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;

        if (wordCount < task.minWords) {
            alert(`Your summary must be at least ${task.minWords} words. You currently have ${wordCount} words.`);
            return;
        }

        // Store the summary text in file_url field
        await submitAttestationWithText(text);
        return;
    }

    // Regular attestation (checkbox)
    const checkbox = document.getElementById('attestationCheckbox');
    if (!checkbox.checked) {
        alert('Please check the box to attest that you have completed this task.');
        return;
    }

    await submitRegularAttestation();
}

// Submit attestation with text (for book summary)
async function submitAttestationWithText(text) {
    const task = BINGO_TASKS[currentTaskIndex];

    try {
        // Insert submission with text stored in file_url
        const submissionData = {
            user_id: currentUser.id,
            square_index: currentTaskIndex,
            square_text: task.text,
            submission_type: 'attestation',
            file_url: text, // Store the book summary in file_url field
            is_challenge: task.isChallenge,
            approval_status: task.isChallenge ? 'pending' : 'approved'
        };

        const { data, error } = await supabase
            .from('bingo_submissions')
            .insert([submissionData])
            .select();

        if (error) throw error;

        // Reload submissions and update UI
        await loadSubmissions();
        renderBingoBoard();
        updateProgress();
        closeTaskModal();

        alert('Book summary submitted successfully!');
    } catch (error) {
        console.error('Error submitting book summary:', error);
        const errorMessage = error.message ? `Failed to submit: ${error.message}` : 'Failed to submit. Please try again.';
        alert(errorMessage);
    }
}

// Submit regular attestation (checkbox only)
async function submitRegularAttestation() {
    const task = BINGO_TASKS[currentTaskIndex];

    try {
        // Insert submission
        const submissionData = {
            user_id: currentUser.id,
            square_index: currentTaskIndex,
            square_text: task.text,
            submission_type: 'attestation',
            file_url: null,
            is_challenge: task.isChallenge,
            approval_status: task.isChallenge ? 'pending' : 'approved'
        };

        const { data, error } = await supabase
            .from('bingo_submissions')
            .insert([submissionData])
            .select();

        if (error) throw error;

        // Reload submissions and update UI
        await loadSubmissions();
        renderBingoBoard();
        updateProgress();
        closeTaskModal();

        if (task.isChallenge) {
            alert('Challenge submission received! It will appear on your board once the admin approves it.');
        } else {
            alert('Task completed successfully!');
        }
    } catch (error) {
        console.error('Error submitting attestation:', error);
        const errorMessage = error.message ? `Failed to submit: ${error.message}` : 'Failed to submit. Please try again.';
        alert(errorMessage);
    }
}

// Submit upload
async function submitUpload() {
    if (!currentFile) {
        alert('Please select a file first.');
        return;
    }

    const submitButton = document.getElementById('submitButton');
    const originalButtonText = submitButton.textContent;

    // Validate file size before starting upload (100MB limit)
    const maxSizeBytes = 100 * 1024 * 1024; // 100MB
    if (currentFile.size > maxSizeBytes) {
        alert(`File is too large. Maximum size is 100MB.\nYour file is ${(currentFile.size / (1024 * 1024)).toFixed(1)}MB.`);
        return;
    }

    console.log(`Starting upload: ${currentFile.name}, size: ${(currentFile.size / (1024 * 1024)).toFixed(2)}MB`);

    submitButton.disabled = true;
    submitButton.textContent = 'Uploading...';

    try {
        const task = BINGO_TASKS[currentTaskIndex];

        // Generate unique file name
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${currentGroupName}/${currentUsername}/${currentTaskIndex}_${Date.now()}.${fileExt}`;

        console.log('Uploading to storage:', fileName);

        // Create upload promise
        const uploadPromise = supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(fileName, currentFile, {
                cacheControl: '3600',
                upsert: false
            });

        // Create timeout promise (90 seconds for large videos)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timed out after 90 seconds. Please check your internet connection and try again.')), 90000);
        });

        // Race between upload and timeout
        const { data: uploadData, error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
        }

        console.log('Upload successful, getting public URL...');

        // Get public URL
        const { data: urlData } = supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName);

        console.log('Public URL obtained:', urlData.publicUrl);
        console.log('Saving submission to database...');

        // Insert submission
        const submissionData = {
            user_id: currentUser.id,
            square_index: currentTaskIndex,
            square_text: task.text,
            submission_type: task.type,
            file_url: urlData.publicUrl,
            is_challenge: task.isChallenge,
            approval_status: task.isChallenge ? 'pending' : 'approved'
        };

        const { data, error } = await supabase
            .from('bingo_submissions')
            .insert([submissionData])
            .select();

        if (error) {
            console.error('Database insert error:', error);
            throw error;
        }

        console.log('Submission saved successfully!');

        // Reload submissions and update UI
        await loadSubmissions();
        renderBingoBoard();
        updateProgress();
        closeTaskModal();
        currentFile = null;

        if (task.isChallenge) {
            alert('Challenge submission received! It will appear on your board once the admin approves it.');
        } else {
            alert('Task completed successfully!');
        }
    } catch (error) {
        console.error('Error submitting upload:', error);
        let errorMessage = 'Failed to upload. Please try again.';

        // Provide more specific error messages
        if (error.message) {
            console.error('Error message:', error.message);

            if (error.message.includes('timed out')) {
                errorMessage = error.message;
            } else if (error.message.includes('bucket') || error.message.includes('not found')) {
                errorMessage = 'Storage bucket not found. Please contact the administrator.';
            } else if (error.message.includes('policy') || error.message.includes('permission')) {
                errorMessage = 'Permission denied. Please contact the administrator.';
            } else if (error.message.includes('size') || error.message.includes('payload')) {
                errorMessage = 'File is too large. Please try a smaller file or compress your video.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection and try again.';
            } else {
                errorMessage = `Upload failed: ${error.message}`;
            }
        }

        alert(errorMessage);
    } finally {
        // Always reset button state, even if there's an error
        console.log('Resetting button state...');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Remove submission
async function removeSubmission(submissionId) {
    if (!confirm('Are you sure you want to remove this submission?')) {
        return;
    }

    try {
        // Find the submission
        const submission = submissions.find(s => s.id === submissionId);
        if (!submission) return;

        // Delete file from storage if it exists
        if (submission.file_url) {
            // Extract file path from URL
            const urlParts = submission.file_url.split('/');
            const storageIndex = urlParts.indexOf('storage');
            if (storageIndex !== -1) {
                const pathParts = urlParts.slice(storageIndex + 3); // Skip 'storage', 'v1', 'object', 'public', bucket name
                if (pathParts.length > 1) {
                    const filePath = pathParts.slice(1).join('/');
                    await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
                }
            }
        }

        // Delete submission from database
        const { error } = await supabase
            .from('bingo_submissions')
            .delete()
            .eq('id', submissionId);

        if (error) throw error;

        // Reload submissions and update UI
        await loadSubmissions();
        renderBingoBoard();
        updateProgress();
        closeTaskModal();

        alert('Submission removed successfully!');
    } catch (error) {
        console.error('Error removing submission:', error);
        alert('Failed to remove submission. Please try again.');
    }
}

// Enable update mode
function enableUpdateMode() {
    const task = BINGO_TASKS[currentTaskIndex];
    const submission = submissions.find(sub => sub.square_index === currentTaskIndex);

    // Remove existing submission and allow new upload
    if (confirm('Do you want to replace this file with a new one?')) {
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = buildNewSubmissionContent(task, currentTaskIndex);
    }
}

// Close task modal
function closeTaskModal() {
    const modal = document.getElementById('taskModal');
    modal.classList.remove('show');
    currentTaskIndex = null;
    currentFile = null;
}

// Close modal when clicking on overlay
function closeModalOnOverlayClick(event) {
    if (event.target.id === 'taskModal') {
        closeTaskModal();
    }
}

// Copy submission link to clipboard
function copySubmissionLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('✓ Link copied to clipboard!\n\nYou can now paste it in WhatsApp to share.');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: show the URL in an alert so they can copy manually
        prompt('Copy this link to share:', url);
    });
}

// Show error
function showError(message) {
    const board = document.getElementById('bingoBoard');
    board.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #c33;">
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
