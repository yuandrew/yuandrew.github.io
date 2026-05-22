(async function () {
    let supabaseClient;

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
    }

    const tableBody = document.getElementById('donorTableBody');
    const donorSummary = document.getElementById('donorSummary');
    const errorMessage = document.getElementById('errorMessage');

    if (!supabaseClient) {
        showError('Supabase is not configured yet.');
        renderEmptyState();
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('fundraiser_public_donors')
            .select('display_name, donation_type, amount, payment_method, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Supabase donor list error:', error);
            showError('Could not load the donor list yet.');
            renderEmptyState();
            return;
        }

        renderDonors(data || []);
    } catch (error) {
        console.error('Unexpected donor list error:', error);
        showError('Something went wrong while loading the donor list.');
        renderEmptyState();
    }

    function renderDonors(donors) {
        tableBody.textContent = '';

        if (donors.length === 0) {
            renderEmptyState();
            return;
        }

        donorSummary.textContent = `${donors.length} committed donor${donors.length === 1 ? '' : 's'}`;

        donors.forEach((donor) => {
            const row = document.createElement('tr');
            row.appendChild(createCell(donor.display_name || 'Anonymous'));
            row.appendChild(createCell(formatCommitment(donor)));
            row.appendChild(createCell(formatPaymentMethod(donor.payment_method)));
            tableBody.appendChild(row);
        });
    }

    function renderEmptyState() {
        donorSummary.textContent = 'No public commitments yet';
        tableBody.textContent = '';

        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.className = 'empty-row';
        cell.colSpan = 3;
        cell.textContent = 'No donors have signed up yet.';
        row.appendChild(cell);
        tableBody.appendChild(row);
    }

    function createCell(text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
    }

    function formatCommitment(donor) {
        const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(Number(donor.amount || 0));

        if (donor.donation_type === 'per_unit') {
            return `${amount} per beer + mile + burger`;
        }

        return `${amount} total`;
    }

    function formatPaymentMethod(paymentMethod) {
        if (paymentMethod === 'venmo') {
            return 'Venmo Andrew';
        }

        if (paymentMethod === 'self_donate') {
            return 'Donate directly';
        }

        return 'Not specified';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
    }
}());
