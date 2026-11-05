exports.validateLoginForm = function(formData) {
    const errors = [];
    let emailError = '';
    let passwordError = '';
    let isValid = true;

    if (!formData.email || formData.email.trim() === '') {
        isValid = false;
        emailError = 'Email is required';
        errors.push('Email is required');
    }

    if (!formData.password || formData.password.trim() === '') {
        isValid = false;
        passwordError = 'Password is required';
        errors.push('Password is required');
    }

    return {
        isValid,
        errors,
        emailError,
        passwordError
    };
};

exports.validateRegistrationForm = function(formData) {
    const errors = [];
    let firstNameError = '';
    let lastNameError = '';
    let emailError = '';
    let passwordError = '';
    let isValid = true;

    if (!formData.firstName || formData.firstName.trim() === '') {
        isValid = false;
        firstNameError = 'First name is required';
        errors.push('First name is required');
    }

    if (!formData.lastName || formData.lastName.trim() === '') {
        isValid = false;
        lastNameError = 'Last name is required';
        errors.push('Last name is required');
    }

    if (!formData.email || formData.email.trim() === '') {
        isValid = false;
        emailError = 'Email is required';
        errors.push('Email is required');
    } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            isValid = false;
            emailError = 'Please enter a valid email address';
            errors.push('Please enter a valid email address');
        }
    }

    if (!formData.password || formData.password.trim() === '') {
        isValid = false;
        passwordError = 'Password is required';
        errors.push('Password is required');

    } else {
        
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,12}$/;
        if (!passwordRegex.test(formData.password)) {
            isValid = false;
            passwordError = 'Password must be 8-12 characters and contain at least one lowercase letter, uppercase letter, number, and symbol';
            errors.push('Password must be 8-12 characters and contain at least one lowercase letter, uppercase letter, number, and symbol');
        }
    }

    return {
        isValid,
        errors,
        firstNameError,
        lastNameError,
        emailError,
        passwordError
    };
};