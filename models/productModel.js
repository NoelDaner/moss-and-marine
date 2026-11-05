// models/productModel.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  variants: [{ label: { type: String, trim: true, required: true }, sku: { type: String, trim: true, uppercase: true, required: true }, price: { type: Number, min: 0.01, required: true }, stockQuantity: { type: Number, min: 0, required: true }, salePrice: { type: Number, min: 0.01 } }],
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0.01
  },
  salePrice: {
    type: Number,
    min: 0.01
  },
  stockQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  specifications: {
    lifespan: { type: String, trim: true },
    minimumTankSizeGallons: { type: Number, min: 0 },
    adultSize: { type: String, trim: true },
    careLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'] },
    lightRequirement: { type: String, enum: ['Low', 'Medium', 'High'] },
    growthRate: { type: String, enum: ['Slow', 'Moderate', 'Fast'] },
    maxHeight: { type: String, trim: true },
    productSize: { type: String, trim: true },
    details: { type: String, trim: true }
  },
  imageUrl: {
    type: String,
    required: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  animalType: { type: String, enum: ["Fish", "Shrimp", "Snail", "Other"], default: undefined },
  animalFamily: { type: String, trim: true, maxlength: 80 },
  isLive: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;