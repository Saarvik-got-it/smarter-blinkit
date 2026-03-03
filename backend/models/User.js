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
        },
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

module.exports = mongoose.model('User', userSchema);
