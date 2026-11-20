import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

const BUCKET_NAME = 'discussionUploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let bucket;

const getBucket = () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('MongoDB must be connected before accessing file storage.');
  }
  if (!bucket) bucket = new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
  return bucket;
};

export const saveUpload = async ({ buffer, filename, contentType, ownerId, originalName }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
    throw Object.assign(new Error('Each photo or file must be between 1 byte and 10 MB.'), { statusCode: 400 });
  }
  const id = new ObjectId();
  const upload = getBucket().openUploadStreamWithId(id, filename, {
    contentType,
    metadata: { ownerId: String(ownerId), originalName, contentType, storageVersion: 1 },
  });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(upload).on('error', reject).on('finish', resolve);
  });
  return id.toHexString();
};

export const getUploadInfo = async (id) => {
  if (!ObjectId.isValid(id)) return null;
  const files = await getBucket().find({ _id: new ObjectId(id) }).limit(1).toArray();
  return files[0] || null;
};

export const openUploadDownloadStream = (id, options = {}) => {
  if (!ObjectId.isValid(id)) throw Object.assign(new Error('Invalid file identifier.'), { statusCode: 404 });
  return getBucket().openDownloadStream(new ObjectId(id), options);
};

export const deleteUpload = async (id) => {
  if (!ObjectId.isValid(id)) return false;
  const info = await getUploadInfo(id);
  if (!info) return false;
  await getBucket().delete(new ObjectId(id));
  return true;
};

export const isValidUploadId = (id) => ObjectId.isValid(id);
