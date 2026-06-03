(function () {
    let supabaseClient;

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
    }

    const form = document.getElementById('fundraiserForm');
    const submitButton = document.getElementById('submitButton');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const amountLabel = document.getElementById('amountLabel');
    const donationTypeInputs = document.querySelectorAll('input[name="donationType"]');

    donationTypeInputs.forEach((input) => {
        input.addEventListener('change', updateAmountLabel);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideMessages();

        if (!supabaseClient) {
            showError('Supabase is not configured yet. Please try again later.');
            return;
        }

        const formData = new FormData(form);
        const name = String(formData.get('name') || '').trim();
        const anonymous = formData.get('anonymous') === 'on';
        const donationType = String(formData.get('donationType') || 'total');
        const amount = Number(formData.get('amount'));
        const paymentMethod = String(formData.get('paymentMethod') || '');
        const email = String(formData.get('email') || '').trim();

        if (!validateForm({ name, donationType, amount, paymentMethod, email })) {
            return;
        }

        setFormEnabled(false);

        try {
            const { error } = await supabaseClient
                .from('fundraiser_donors')
                .insert([{
                    name,
                    anonymous,
                    donation_type: donationType,
                    amount,
                    payment_method: paymentMethod,
                    email
                }]);

            if (error) {
                console.error('Supabase insert error:', error);
                showError('Could not submit your pledge. Please try again.');
                setFormEnabled(true);
                return;
            }

            form.reset();
            updateAmountLabel();
            showSuccess('Pledge submitted. Thank you.');
            setFormEnabled(true);
        } catch (error) {
            console.error('Unexpected fundraiser submit error:', error);
            showError('Something went wrong. Please try again.');
            setFormEnabled(true);
        }
    });

    function updateAmountLabel() {
        const donationType = document.querySelector('input[name="donationType"]:checked').value;
        amountLabel.textContent = donationType === 'per_unit'
            ? 'Pledge per beer + mile + burger'
            : 'Total donation amount';
    }

    function validateForm(values) {
        if (values.name.length < 2) {
            showError('Please enter your name.');
            return false;
        }

        if (!['total', 'per_unit'].includes(values.donationType)) {
            showError('Please choose a donation pledge type.');
            return false;
        }

        if (!Number.isFinite(values.amount) || values.amount <= 0) {
            showError('Please enter a donation amount greater than $0.');
            return false;
        }

        if (!['venmo', 'self_donate'].includes(values.paymentMethod)) {
            showError('Please choose a donation method.');
            return false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            showError('Please enter a valid email address.');
            return false;
        }

        return true;
    }

    function setFormEnabled(enabled) {
        Array.from(form.elements).forEach((element) => {
            element.disabled = !enabled;
        });
        submitButton.textContent = enabled ? 'Submit pledge' : 'Submitting...';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.classList.add('show');
    }

    function hideMessages() {
        errorMessage.textContent = '';
        successMessage.textContent = '';
        errorMessage.classList.remove('show');
        successMessage.classList.remove('show');
    }
}());
