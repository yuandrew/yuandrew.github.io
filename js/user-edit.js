// User edit page logic for Christmas Bingo

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

// Global error handler for debugging
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    console.error('Error message:', event.message);
    console.error('Error at:', event.filename, event.lineno, event.colno);

    // Show error on screen for mobile debugging
    showDebugMessage(`ERROR: ${event.message} at line ${event.lineno}`);
});

// Debug message display for mobile
function showDebugMessage(message) {
    // Create or get debug div
    let debugDiv = document.getElementById('debugMessages');
    if (!debugDiv) {
        debugDiv = document.createElement('div');
        debugDiv.id = 'debugMessages';
        debugDiv.style.position = 'fixed';
        debugDiv.style.bottom = '10px';
        debugDiv.style.left = '10px';
        debugDiv.style.right = '10px';
        debugDiv.style.background = 'rgba(0, 0, 0, 0.9)';
        debugDiv.style.color = '#0f0';
        debugDiv.style.padding = '10px';
        debugDiv.style.fontFamily = 'monospace';
        debugDiv.style.fontSize = '11px';
        debugDiv.style.maxHeight = '200px';
        debugDiv.style.overflow = 'auto';
        debugDiv.style.zIndex = '10000';
        debugDiv.style.borderRadius = '5px';
        document.body.appendChild(debugDiv);
    }

    const timestamp = new Date().toLocaleTimeString();
    debugDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
}

// Define the 25 bingo tasks
const BINGO_TASKS = [
    { text: "send a picture with you family", type: "photo", isChallenge: false },
    { text: "send a video of you saying something you're thankful for in 2025 (share to group chat)", type: "attestation", isChallenge: false },
    { text: "cook your family a meal and record their review (share to group chat)", type: "attestation", isChallenge: false },
    { text: "record yourself calling a friend and telling them you love them (share to group chat)", type: "attestation", isChallenge: false },
    { text: "hold a plank for one full worship song - NO BREAKS (share video to group chat)", type: "attestation", isChallenge: false },
    { text: "record yourself giving someone a present and them opening it (share to group chat)", type: "attestation", isChallenge: false },
    { text: "volunteer somewhere", type: "photo", isChallenge: false },
    { text: "CHALLENGE: Bake the biggest Christmas-shaped cookie (Only 3 biggest cookies can X this square)", type: "photo", isChallenge: true },
    { text: "Do a dramatic reading of Luke 2:1–20 (share video to group chat)", type: "attestation", isChallenge: false },
    { text: "read a book and add a summary", type: "attestation", isChallenge: false, requiresText: true, minWords: 100 },
    { text: "chug a sparkling water without burping - record whole thing or no credit (share to group chat)", type: "attestation", isChallenge: false },
    { text: "CHALLENGE: wrap a gift with oven mitts on - only fastest person can X (share video to group chat)", type: "attestation", isChallenge: true },
    { text: "attend church :)", type: "attestation", isChallenge: false },
    { text: "record yourself doing 25 push ups in a row with Christmas decor behind you 🎄 (share to group chat)", type: "attestation", isChallenge: false },
    { text: "go to a Christmas market", type: "photo", isChallenge: false },
    { text: "build a Christmas tree out of objects that aren't a tree", type: "photo", isChallenge: false },
    { text: "make a gingerbread house", type: "photo", isChallenge: false },
    { text: "make a cup of hot cocoa for someone else and record you giving it to them (share to group chat)", type: "attestation", isChallenge: false },
    { text: "take a photo with Santa or a reindeer", type: "photo", isChallenge: false },
    { text: "decorate a Christmas tree and photo with your favorite ornament", type: "photo", isChallenge: false },
    { text: "record yourself singing a Christmas song (share to group chat)", type: "attestation", isChallenge: false },
    { text: "reenact the birth of Jesus using sock puppets (share video to group chat)", type: "attestation", isChallenge: false },
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
            <div class="upload-section" id="uploadSection">
                <div id="uploadPrompt">
                    <div style="font-size: 3em; margin-bottom: 15px;">${fileIcon}</div>

                    <div style="margin-bottom: 20px;">
                        <button type="button" class="upload-button" onclick="event.stopPropagation(); document.getElementById('fileInput').click();">
                            ${task.type === 'video' ? '🎥 Upload Video (< 50MB)' : '📷 Upload Photo'}
                        </button>
                        <input type="file" id="fileInput" accept="${acceptType}" onchange="handleFileSelect(event)" style="position: absolute; left: -9999px;">
                    </div>

                    ${task.type === 'video' ? `
                    <div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 8px;">
                        <div style="font-weight: bold; margin-bottom: 10px;">Or paste a video link:</div>
                        <input type="text" id="videoLinkInput" placeholder="Google Drive, Dropbox, YouTube, etc."
                               style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px;">
                        <div style="font-size: 0.85em; color: #666; margin-top: 8px;">
                            📝 Tip: Upload large videos to Google Drive or Dropbox and paste the shareable link here
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div id="filePreview" style="display: none;">
                    <div id="previewContainer"></div>
                    <p id="fileName" style="margin-top: 15px; font-weight: bold;"></p>
                    <button type="button" class="btn-secondary" onclick="clearFileSelection()" style="margin-top: 10px;">
                        Choose Different File
                    </button>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeTaskModal()">Cancel</button>
                <button type="button" class="btn-primary" id="submitButton" onclick="event.stopPropagation(); handleSubmitUpload();" disabled>
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

    showDebugMessage(`File selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);

    // Show preview
    const uploadPrompt = document.getElementById('uploadPrompt');
    const filePreview = document.getElementById('filePreview');
    const previewContainer = document.getElementById('previewContainer');
    const fileName = document.getElementById('fileName');
    const submitButton = document.getElementById('submitButton');

    uploadPrompt.style.display = 'none';
    filePreview.style.display = 'block';
    fileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`;

    // Skip preview for large files (> 50MB) to avoid crashing mobile browsers
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
        showDebugMessage('Skipping preview for large file to save memory');
        previewContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; background: #f5f5f5; border-radius: 8px;">
                <div style="font-size: 3em; margin-bottom: 10px;">📹</div>
                <div style="color: #666;">Large video selected</div>
                <div style="color: #999; font-size: 0.9em; margin-top: 5px;">Preview disabled to save memory</div>
            </div>
        `;
    } else {
        // Create preview for smaller files only
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
    }

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

// Compress video using HTML5 Canvas and MediaRecorder
async function compressVideo(file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true; // Mute to allow autoplay
        video.playsInline = true; // Important for iOS Safari
        video.style.display = 'none'; // Hide completely
        video.style.position = 'absolute';
        video.style.left = '-9999px';
        video.controls = false;
        video.autoplay = false;

        video.onloadedmetadata = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set max dimensions (720p should be sufficient for bingo tasks)
            const maxWidth = 1280;
            const maxHeight = 720;
            let width = video.videoWidth;
            let height = video.videoHeight;

            // Calculate new dimensions maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;
                if (width > height) {
                    width = maxWidth;
                    height = maxWidth / aspectRatio;
                } else {
                    height = maxHeight;
                    width = maxHeight * aspectRatio;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Check if MediaRecorder is supported
            if (!window.MediaRecorder) {
                reject(new Error('Video compression not supported on this browser'));
                return;
            }

            // Try different codecs for better compatibility
            let mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'video/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        reject(new Error('No supported video codec found'));
                        return;
                    }
                }
            }

            console.log('Using codec:', mimeType);

            // Set up MediaRecorder to compress the video
            const stream = canvas.captureStream(30); // 30 FPS
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 1000000 // 1 Mbps
            });

            const chunks = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
                const compressedBlob = new Blob(chunks, { type: mimeType });
                const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, `.${extension}`), {
                    type: mimeType,
                    lastModified: Date.now()
                });

                // Clean up
                URL.revokeObjectURL(video.src);
                video.remove();
                canvas.remove();

                resolve(compressedFile);
            };

            mediaRecorder.onerror = (error) => {
                console.error('MediaRecorder error:', error);
                URL.revokeObjectURL(video.src);
                reject(error);
            };

            // Play the video and draw frames to canvas
            video.currentTime = 0;

            // Prevent any video events from causing page issues
            video.addEventListener('play', (e) => e.stopPropagation());
            video.addEventListener('pause', (e) => e.stopPropagation());
            video.addEventListener('ended', (e) => e.stopPropagation());
            video.addEventListener('loadstart', (e) => e.stopPropagation());

            video.play().then(() => {
                mediaRecorder.start();

                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx.drawImage(video, 0, 0, width, height);
                        requestAnimationFrame(drawFrame);
                    } else if (video.ended) {
                        mediaRecorder.stop();
                    }
                };

                drawFrame();
            }).catch(err => {
                console.error('Video play error:', err);
                URL.revokeObjectURL(video.src);
                video.remove();
                reject(new Error('Failed to play video for compression'));
            });
        };

        video.onerror = (err) => {
            console.error('Video load error:', err);
            reject(new Error('Failed to load video for compression'));
        };

        video.src = URL.createObjectURL(file);
    });
}

// Submit video link (alternative to file upload for large videos)
async function submitVideoLink(videoUrl) {
    const submitButton = document.getElementById('submitButton');
    if (!submitButton) return;

    const originalButtonText = submitButton.textContent;

    try {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        showDebugMessage(`Submitting link: ${videoUrl}`);

        const task = BINGO_TASKS[currentTaskIndex];

        // Insert submission directly with the video URL
        const submissionData = {
            user_id: currentUser.id,
            square_index: currentTaskIndex,
            square_text: task.text,
            submission_type: task.type,
            file_url: videoUrl, // Store the link directly
            is_challenge: task.isChallenge,
            approval_status: task.isChallenge ? 'pending' : 'approved'
        };

        showDebugMessage('Saving to database...');

        const { data, error } = await supabase
            .from('bingo_submissions')
            .insert([submissionData])
            .select();

        if (error) {
            showDebugMessage(`Database error: ${error.message}`);
            throw error;
        }

        showDebugMessage('Link submitted successfully!');

        // Clear upload state
        localStorage.removeItem('bingo_upload_state');

        // Reload submissions and update UI
        await loadSubmissions();
        renderBingoBoard();
        updateProgress();
        closeTaskModal();
        currentFile = null;

        if (task.isChallenge) {
            alert('Challenge submission received! It will appear on your board once the admin approves it.');
        } else {
            alert('Video link submitted successfully!');
        }
    } catch (error) {
        console.error('Error submitting video link:', error);
        showDebugMessage(`ERROR: ${error.message}`);
        alert(`Failed to submit: ${error.message}`);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    }
}

// Handle submit upload button click (wrapper to prevent modal closing issues)
function handleSubmitUpload() {
    console.log('handleSubmitUpload called');
    showDebugMessage('Upload button clicked');

    // Call the async function and catch any errors
    submitUpload().catch(error => {
        console.error('Uncaught error in submitUpload:', error);
        showDebugMessage(`ERROR in submitUpload: ${error.message}`);
        alert('An unexpected error occurred: ' + error.message);

        // Try to reset button state
        const submitButton = document.getElementById('submitButton');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Upload & Submit';
        }
    });
}

// Submit upload
async function submitUpload() {
    showDebugMessage('submitUpload started');

    // Check if user provided a video link instead
    const videoLinkInput = document.getElementById('videoLinkInput');
    const hasLink = videoLinkInput && videoLinkInput.value.trim();

    if (!currentFile && !hasLink) {
        showDebugMessage('ERROR: No file or link provided');
        alert('Please select a file or paste a video link.');
        return;
    }

    // If user provided a link, submit that instead
    if (hasLink && !currentFile) {
        showDebugMessage('Submitting video link instead of upload');
        await submitVideoLink(videoLinkInput.value.trim());
        return;
    }

    const submitButton = document.getElementById('submitButton');
    if (!submitButton) {
        showDebugMessage('ERROR: Submit button not found');
        return;
    }

    const originalButtonText = submitButton.textContent;
    const fileSize = (currentFile.size / (1024 * 1024)).toFixed(2);

    showDebugMessage(`File: ${currentFile.name}, Size: ${fileSize}MB`);

    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    // Save state in case of page refresh
    const uploadState = {
        taskIndex: currentTaskIndex,
        fileName: currentFile.name,
        fileSize: currentFile.size,
        timestamp: Date.now()
    };
    localStorage.setItem('bingo_upload_state', JSON.stringify(uploadState));

    try {
        const task = BINGO_TASKS[currentTaskIndex];
        let fileToUpload = currentFile;

        showDebugMessage('Starting upload process...');
        submitButton.textContent = 'Uploading...';

        // Generate unique file name
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${currentGroupName}/${currentUsername}/${currentTaskIndex}_${Date.now()}.${fileExt}`;

        showDebugMessage(`Uploading to: ${fileName}`);

        // Create upload promise
        const uploadPromise = supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(fileName, fileToUpload, {
                cacheControl: '3600',
                upsert: false
            });

        // Create timeout promise (90 seconds for large videos)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timed out after 90 seconds. Please check your internet connection and try again.')), 90000);
        });

        showDebugMessage('Waiting for upload...');

        // Race between upload and timeout
        const { data: uploadData, error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);

        if (uploadError) {
            showDebugMessage(`Upload error: ${uploadError.message}`);
            throw uploadError;
        }

        showDebugMessage('Upload complete! Getting URL...');

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

        // Clear upload state
        localStorage.removeItem('bingo_upload_state');

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
                errorMessage = `File is too large for Supabase storage. Actual error: ${error.message}\n\nYou need to increase the file size limit in your Supabase project settings.`;
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
