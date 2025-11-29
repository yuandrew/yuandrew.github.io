// Registration logic for Christmas Bingo

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    showError('Configuration error. Please contact the administrator.');
}

// Constants
const CORRECT_PASSWORD = 'picklemuffins';
const MAX_GROUP_NAME_LENGTH = 50;
const MIN_GROUP_NAME_LENGTH = 3;

// DOM elements
const form = document.getElementById('registerForm');
const groupNameInput = document.getElementById('groupName');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submitButton');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Form submission handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const groupName = groupNameInput.value.trim();
    const password = passwordInput.value;

    // Clear previous messages
    hideError();
    hideSuccess();

    // Validate inputs
    if (!validateInputs(groupName, password)) {
        return;
    }

    // Disable form while processing
    setFormEnabled(false);

    try {
        // Create the group in Supabase
        const { data, error } = await supabase
            .from('groups')
            .insert([{ name: groupName }])
            .select();

        if (error) {
            if (error.code === '23505') { // Unique violation
                showError('This group name is already taken. Please choose another one.');
            } else {
                console.error('Supabase error:', error);
                showError('Failed to create group. Please try again.');
            }
            setFormEnabled(true);
            return;
        }

        // Success! Redirect to the group page
        showSuccess('Group created successfully! Redirecting...');
        setTimeout(() => {
            window.location.href = `/christmas-bingo/${groupName}/`;
        }, 1500);

    } catch (error) {
        console.error('Error creating group:', error);
        showError('An unexpected error occurred. Please try again.');
        setFormEnabled(true);
    }
});

// Validation function
function validateInputs(groupName, password) {
    // Check password
    if (password !== CORRECT_PASSWORD) {
        showError('Incorrect password. You need the correct password to create a group.');
        return false;
    }

    // Check group name length
    if (groupName.length < MIN_GROUP_NAME_LENGTH) {
        showError(`Group name must be at least ${MIN_GROUP_NAME_LENGTH} characters long.`);
        return false;
    }

    if (groupName.length > MAX_GROUP_NAME_LENGTH) {
        showError(`Group name must be no more than ${MAX_GROUP_NAME_LENGTH} characters long.`);
        return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!validNamePattern.test(groupName)) {
        showError('Group name can only contain letters, numbers, hyphens, and underscores.');
        return false;
    }

    // Check for potentially malicious patterns
    const suspiciousPatterns = [
        /script/i,
        /javascript/i,
        /<.*>/,
        /\.\./,
        /[<>'"]/
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(groupName)) {
            showError('Group name contains invalid characters.');
            return false;
        }
    }

    return true;
}

// UI Helper functions
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
}

function hideError() {
    errorMessage.textContent = '';
    errorMessage.classList.remove('show');
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.add('show');
}

function hideSuccess() {
    successMessage.textContent = '';
    successMessage.classList.remove('show');
}

function setFormEnabled(enabled) {
    submitButton.disabled = !enabled;
    groupNameInput.disabled = !enabled;
    passwordInput.disabled = !enabled;

    if (!enabled) {
        submitButton.textContent = 'Creating...';
    } else {
        submitButton.textContent = 'Create Group';
    }
}

// Real-time validation feedback
groupNameInput.addEventListener('input', () => {
    const value = groupNameInput.value.trim();
    if (value.length > 0 && value.length < MIN_GROUP_NAME_LENGTH) {
        groupNameInput.setCustomValidity(`Minimum ${MIN_GROUP_NAME_LENGTH} characters`);
    } else if (value.length > MAX_GROUP_NAME_LENGTH) {
        groupNameInput.setCustomValidity(`Maximum ${MAX_GROUP_NAME_LENGTH} characters`);
    } else {
        groupNameInput.setCustomValidity('');
    }
});
