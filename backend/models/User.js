const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, minlength: 6 },
        role: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
        phone: { type: String, trim: true },
        location: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
            address: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            pincode: { type: String, default: '' },
            country: { type: String, default: 'India' },
        },
        savedAddresses: [{
            tag: { type: String, default: 'Home' }, // e.g., 'Home', 'Work', 'Other'
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], default: [0, 0] },
            address: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            pincode: { type: String, default: '' },
            country: { type: String, default: 'India' },
        }],
        avatar: { type: String, default: '' },
        faceDescriptor: { type: [Number], default: [] }, // face-api.js descriptor
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

userSchema.index({ 'location': '2dsphere' });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.faceDescriptor;
    return obj;
};

// ── Auto-update Excel report on new user creation ──────────────
const path = require('path');
let _reportTimer = null;
userSchema.post('save', function () {
    console.log('📋 User saved — scheduling report regeneration…');
    // Debounce: wait 2s before regenerating (avoids rapid-fire during bulk ops)
    if (_reportTimer) clearTimeout(_reportTimer);
    _reportTimer = setTimeout(async () => {
        try {
            // Lazy require with absolute path to avoid circular dependency
            const servicePath = path.join(__dirname, '..', 'services', 'userReportService');
            const { generateUserReport } = require(servicePath);
            await generateUserReport();
            console.log('✅ Auto-report regeneration complete');
        } catch (err) {
            console.error('⚠️ Auto-report generation failed:', err.message);
        }
    }, 2000);
});

module.exports = mongoose.model('User', userSchema);
