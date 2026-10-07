const multer = require('multer');

// CSV файлыг диск рүү бичихгүйгээр шууд санах ойд (buffer) авна —
// бага хэмжээний (2MB хүртэл) жагсаалт тул диск бичих шаардлагагүй.
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const okExt = /\.csv$/i.test(file.originalname);
  const okMime = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/csv',
    'text/plain',
    'application/octet-stream',
  ].includes(file.mimetype);

  if (okExt || okMime) return cb(null, true);
  cb(new Error('Зөвхөн .csv файл оруулна уу'));
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter,
});

module.exports = upload;