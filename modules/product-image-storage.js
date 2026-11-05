// Uploaded product photos live in MongoDB GridFS, not ephemeral deployment files.
const mongoose = require('mongoose');
const { Readable } = require('stream');
const { ObjectId, GridFSBucket } = mongoose.mongo;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
const path = require('path');

function bucket() {
  if (!mongoose.connection.db) throw new Error('MongoDB is not connected');
  return new GridFSBucket(mongoose.connection.db, { bucketName: 'productPhotos' });
}
async function saveProductImage(file) {
  const ext = path.extname(file.name || '').toLowerCase();
  const contentType = TYPES[ext];
  if (!contentType || !file.data || file.data.length > MAX_BYTES) throw new Error('Image must be JPG, PNG, GIF, or WEBP, maximum 8 MB');
  const upload = bucket().openUploadStream(path.basename(file.name), { contentType, metadata: { purpose: 'product' } });
  await new Promise((resolve, reject) => {
    Readable.from(file.data).pipe(upload).on('finish', resolve).on('error', reject);
  });
  return `/media/products/${upload.id.toString()}`;
}
async function deleteProductImage(url) {
  const match = /^\/media\/products\/([a-f\d]{24})$/.exec(url || '');
  if (!match) return; // Never remove legacy static images.
  try { await bucket().delete(new ObjectId(match[1])); }
  catch (err) { if (err.code !== 'ENOENT') console.error('Image cleanup failed:', err); }
}
async function serveProductImage(req, res) {
  if (!/^[a-f\d]{24}$/.test(req.params.id)) return res.sendStatus(404);
  try {
    const id = new ObjectId(req.params.id);
    const files = await bucket().find({ _id: id }).limit(1).toArray();
    if (!files.length) return res.sendStatus(404);
    res.type(files[0].contentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    bucket().openDownloadStream(id).on('error', err => {
      console.error('Image streaming failed:', err);
      if (!res.headersSent) res.sendStatus(404); else res.destroy();
    }).pipe(res);
  } catch (err) { console.error(err); if (!res.headersSent) res.sendStatus(500); }
}
module.exports = { saveProductImage, deleteProductImage, serveProductImage };
