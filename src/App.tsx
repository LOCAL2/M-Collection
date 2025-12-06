import { useState, useEffect, useRef } from 'react';
import { supabase, type Image } from './lib/supabase';

function App() {
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [imagesPerPage, setImagesPerPage] = useState(12);
  const [deleteConfirm, setDeleteConfirm] = useState<Image | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [viewImage, setViewImage] = useState<Image | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [uploadCount, setUploadCount] = useState({ current: 0, total: 0 });
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; cancelled: boolean } | null>(null);
  const downloadCancelledRef = useRef(false);
  const [downloadingImageId, setDownloadingImageId] = useState<string | number | null>(null);
  const [imageDownloadProgress, setImageDownloadProgress] = useState(0);
  const pendingFilesRef = useRef<FileList | null>(null);

  // ฟังก์ชันแปลงชื่อภาษาไทยเป็นภาษาอังกฤษ (transliteration)
  const transliterateThaiToEng = (text: string): string => {
    const thaiToEng: { [key: string]: string } = {
      'ก': 'k', 'ข': 'kh', 'ฃ': 'kh', 'ค': 'kh', 'ฅ': 'kh', 'ฆ': 'kh',
      'ง': 'ng', 'จ': 'j', 'ฉ': 'ch', 'ช': 'ch', 'ซ': 's', 'ฌ': 'ch',
      'ญ': 'y', 'ฎ': 'd', 'ฏ': 't', 'ฐ': 'th', 'ฑ': 'th', 'ฒ': 'th',
      'ณ': 'n', 'ด': 'd', 'ต': 't', 'ถ': 'th', 'ท': 'th', 'ธ': 'th',
      'น': 'n', 'บ': 'b', 'ป': 'p', 'ผ': 'ph', 'ฝ': 'f', 'พ': 'ph',
      'ฟ': 'f', 'ภ': 'ph', 'ม': 'm', 'ย': 'y', 'ร': 'r', 'ฤ': 'rue',
      'ล': 'l', 'ฦ': 'lue', 'ว': 'w', 'ศ': 's', 'ษ': 's', 'ส': 's',
      'ห': 'h', 'ฬ': 'l', 'อ': 'o', 'ฮ': 'h',
      'ะ': 'a', 'ั': 'a', 'า': 'a', 'ำ': 'am', 'ิ': 'i', 'ี': 'i',
      'ึ': 'ue', 'ื': 'ue', 'ุ': 'u', 'ู': 'u', 'เ': 'e', 'แ': 'ae',
      'โ': 'o', 'ใ': 'ai', 'ไ': 'ai', 'ๅ': '', '็': '', '่': '',
      '้': '', '๊': '', '๋': '', '์': '', 'ํ': '', 'ๆ': '', '฿': ''
    };

    return text
      .split('')
      .map(char => thaiToEng[char] || char)
      .join('')
      .replace(/[^a-zA-Z0-9]/g, '') // ลบอักขระพิเศษออก
      .toLowerCase();
  };

  useEffect(() => {
    const savedImagesPerPage = localStorage.getItem('imagesPerPage');
    if (savedImagesPerPage) setImagesPerPage(Number(savedImagesPerPage));
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);

    const savedName = localStorage.getItem('userName');
    if (savedName) {
      setUserName(savedName);
    } else {
      // ถ้ายังไม่มีชื่อ บังคับให้ใส่ชื่อทันที
      setShowNamePrompt(true);
    }

    fetchImages();
    subscribeToChanges();

    // Polling ทุก 100ms เพื่อเช็ครูปใหม่
    const pollingInterval = setInterval(() => {
      fetchImages();
    }, 100);

    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchImages = async () => {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching images:', error);
    } else {
      setImages(data || []);
    }
    setLoading(false);
  };

  const subscribeToChanges = () => {
    const channel = supabase
      .channel('images-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'images' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // เช็คว่ารูปมีอยู่แล้วหรือไม่ (ป้องกันการซ้ำ)
            setImages((prev) => {
              const exists = prev.some((img) => img.id === (payload.new as Image).id);
              if (exists) return prev;
              return [payload.new as Image, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            setImages((prev) => prev.filter((img) => img.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setImages((prev) =>
              prev.map((img) => (img.id === (payload.new as Image).id ? (payload.new as Image) : img))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleUpload = async (files: FileList | null) => {
    // เช็คว่ามีไฟล์และไม่ใช่ค่าว่าง
    if (!files || files.length === 0) {
      console.log('No files selected');
      return;
    }

    // เช็คว่าไฟล์เป็นรูปภาพจริงๆ
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setToast({
        message: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        type: 'error'
      });
      return;
    }

    if (!userName) {
      // เก็บไฟล์ไว้ก่อน แล้วค่อย upload หลังจากใส่ชื่อเสร็จ
      pendingFilesRef.current = files;
      setShowNamePrompt(true);
      return;
    }

    // ป้องกันการ upload ซ้ำ
    if (uploading) {
      console.log('Already uploading');
      return;
    }

    console.log(`Starting upload of ${validFiles.length} files`);
    setUploading(true);
    setUploadProgress(0);
    setUploadCount({ current: 0, total: validFiles.length });

    try {
      const newImages: Image[] = [];
      const totalFiles = validFiles.length;
      let skippedCount = 0;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        console.log(`Processing file ${i + 1}/${totalFiles}: ${file.name}`);
        
        // คำนวณ progress ตามจำนวนไฟล์
        const baseProgress = Math.floor((i / totalFiles) * 90);
        setUploadProgress(baseProgress);
        setUploadCount({ current: i + 1, total: totalFiles });

        // เช็คว่ามีไฟล์ซ้ำใน database หรือไม่ (เช็คจาก filename, file_size, mime_type และ uploader)
        const { data: existingImages } = await supabase
          .from('images')
          .select('*')
          .eq('filename', file.name)
          .eq('file_size', file.size)
          .eq('mime_type', file.type)
          .eq('uploader_name', userName);

        if (existingImages && existingImages.length > 0) {
          console.log(`Duplicate file detected in database: ${file.name} (${file.size} bytes)`);
          skippedCount++;
          continue;
        }

        // สร้างชื่อไฟล์ที่ไม่ซ้ำ และแปลงชื่อผู้ใช้เป็นภาษาอังกฤษ
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        const fileName = `${timestamp}-${random}.${fileExt}`;
        // แปลงชื่อผู้ใช้เป็นภาษาอังกฤษ (ถ้าเป็นภาษาไทย)
        const safeUserName = transliterateThaiToEng(userName) || 'user';
        const filePath = `${safeUserName}/${fileName}`;

        // Upload ไฟล์
        const { error: uploadError } = await supabase.storage
          .from('gallery-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          // ถ้า error เพราะไฟล์มีอยู่แล้ว ให้ข้ามไป
          if (uploadError.message.includes('already exists')) {
            console.log(`File already exists in storage: ${filePath}`);
            skippedCount++;
            continue;
          }
          throw uploadError;
        }

        // ดึง URL
        const { data: urlData } = supabase.storage
          .from('gallery-images')
          .getPublicUrl(filePath);

        console.log('File uploaded, inserting to database...');

        // บันทึกข้อมูลลง database
        const { data: insertedData, error: dbError } = await supabase
          .from('images')
          .insert({
            filename: file.name,
            storage_path: filePath,
            url: urlData.publicUrl,
            uploader_name: userName,
            file_size: file.size,
            mime_type: file.type,
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }
        
        if (insertedData) {
          console.log('Image saved to database:', insertedData.id);
          newImages.push(insertedData);
        }
      }

      // เพิ่มรูปใหม่เข้า state ทันที
      if (newImages.length > 0) {
        setImages((prev) => [...newImages, ...prev]);
      }

      setUploadProgress(100);
      
      // แสดงผลลัพธ์
      if (skippedCount > 0) {
        console.log(`Upload completed: ${newImages.length} uploaded, ${skippedCount} skipped (duplicates)`);
        setToast({
          message: `อัปโหลดสำเร็จ ${newImages.length} ไฟล์ • ข้าม ${skippedCount} ไฟล์ที่ซ้ำ`,
          type: 'info'
        });
      } else {
        console.log(`Upload completed successfully: ${newImages.length} files uploaded`);
        setToast({
          message: `อัปโหลดสำเร็จ ${newImages.length} ไฟล์`,
          type: 'success'
        });
      }

      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
        setUploadCount({ current: 0, total: 0 });
      }, 1000);
    } catch (error) {
      console.error('Error uploading:', error);
      setToast({
        message: 'เกิดข้อผิดพลาดในการอัปโหลด กรุณาลองใหม่อีกครั้ง',
        type: 'error'
      });
      setUploading(false);
      setUploadProgress(0);
      setUploadCount({ current: 0, total: 0 });
    }
  };



  const handleNameSubmit = () => {
    if (userName.trim()) {
      localStorage.setItem('userName', userName.trim());
      setShowNamePrompt(false);
      
      // ถ้ามีไฟล์รออยู่ ให้ upload ทันที
      if (pendingFilesRef.current) {
        const files = pendingFilesRef.current;
        pendingFilesRef.current = null;
        // ใช้ setTimeout เพื่อให้ modal ปิดก่อน
        setTimeout(() => {
          handleUpload(files);
        }, 100);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleUpload(files);
    }
  };

  const handleDeleteClick = (image: Image) => {
    setDeleteConfirm(image);
  };

  const handleDownloadImage = async (image: Image) => {
    try {
      setDownloadingImageId(image.id);
      setImageDownloadProgress(0);

      // สร้าง XMLHttpRequest เพื่อ track progress
      const { data: { publicUrl } } = supabase.storage
        .from('gallery-images')
        .getPublicUrl(image.storage_path);

      const response = await fetch(publicUrl);
      if (!response.ok) throw new Error('Download failed');

      const reader = response.body?.getReader();
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          const progress = contentLength > 0 ? (receivedLength / contentLength) * 100 : 0;
          setImageDownloadProgress(Math.round(progress));
        }
      }

      const blob = new Blob(chunks as BlobPart[]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = image.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadingImageId(null);
      setImageDownloadProgress(0);

      setToast({
        message: 'ดาวน์โหลดสำเร็จ',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      setDownloadingImageId(null);
      setImageDownloadProgress(0);
      setToast({
        message: 'เกิดข้อผิดพลาดในการดาวน์โหลด',
        type: 'error'
      });
    }
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) {
      setToast({
        message: 'ไม่มีรูปภาพให้ดาวน์โหลด',
        type: 'error'
      });
      return;
    }

    // เริ่มแสดง modal
    downloadCancelledRef.current = false;
    setDownloadProgress({ current: 0, total: images.length, cancelled: false });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < images.length; i++) {
      // เช็คว่ายกเลิกหรือไม่
      if (downloadCancelledRef.current) {
        break;
      }

      const image = images[i];
      
      try {
        const { data, error } = await supabase.storage
          .from('gallery-images')
          .download(image.storage_path);

        if (error) throw error;

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = image.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        successCount++;
      } catch (error) {
        console.error(`Error downloading ${image.filename}:`, error);
        failCount++;
      }

      // อัปเดตความคืบหน้า
      setDownloadProgress(prev => 
        prev ? { ...prev, current: i + 1 } : null
      );

      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const wasCancelled = downloadCancelledRef.current;

    // ปิด modal
    setDownloadProgress(null);

    // แสดงผลลัพธ์
    if (wasCancelled) {
      setToast({
        message: `ยกเลิกการดาวน์โหลด • สำเร็จ ${successCount} ไฟล์`,
        type: 'info'
      });
    } else if (failCount === 0) {
      setToast({
        message: `ดาวน์โหลดสำเร็จ ${successCount} ไฟล์`,
        type: 'success'
      });
    } else {
      setToast({
        message: `ดาวน์โหลดสำเร็จ ${successCount} ไฟล์ • ล้มเหลว ${failCount} ไฟล์`,
        type: 'info'
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      // ลบไฟล์จาก storage
      const { error: storageError } = await supabase.storage
        .from('gallery-images')
        .remove([deleteConfirm.storage_path]);

      if (storageError) throw storageError;

      // ลบข้อมูลจาก database
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', deleteConfirm.id);

      if (dbError) throw dbError;

      // อัปเดต state
      setImages((prev) => prev.filter((img) => img.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      setToast({
        message: 'ลบรูปภาพสำเร็จ',
        type: 'success'
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      setToast({
        message: 'เกิดข้อผิดพลาดในการลบรูป กรุณาลองใหม่อีกครั้ง',
        type: 'error'
      });
    }
  };

  return (
    <div
      className={`min-h-screen transition-all duration-500 ${
        theme === 'dark'
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
          : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
      }`}
    >
      {/* Glassmorphism Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-20 left-20 w-96 h-96 rounded-full blur-3xl opacity-20 ${
            theme === 'dark' ? 'bg-blue-500' : 'bg-blue-300'
          }`}
        />
        <div
          className={`absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl opacity-20 ${
            theme === 'dark' ? 'bg-purple-500' : 'bg-purple-300'
          }`}
        />
      </div>

      {/* Image Viewer Modal */}
      {viewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-pointer"
          onClick={() => setViewImage(null)}
        >
          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadImage(viewImage);
              }}
              className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all backdrop-blur-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => setViewImage(null)}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all backdrop-blur-sm cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="flex flex-col items-center max-w-6xl w-full max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full flex items-center justify-center" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              <img
                src={viewImage.url}
                alt={viewImage.filename}
                className="max-w-full max-h-full object-contain rounded-2xl"
                style={{ maxHeight: 'calc(90vh - 100px)' }}
              />
            </div>
            <div className="mt-4 text-center space-y-2">
              <p className="text-white text-lg font-medium">จากผู้ใช้: {viewImage.uploader_name}</p>
              <p className="text-white/70 text-sm">
                {new Date(viewImage.created_at).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-gray-900/80 border-gray-700'
                : 'bg-white/80 border-gray-200'
            }`}
          >
            <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              ยืนยันการลบรูป
            </h3>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              คุณต้องการลบรูปนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-6 py-3 rounded-xl font-medium transition-all bg-red-500 text-white hover:bg-red-600 cursor-pointer"
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Progress Modal */}
      {downloadProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-gray-900/80 border-gray-700'
                : 'bg-white/80 border-gray-200'
            }`}
          >
            <h3 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              กำลังดาวน์โหลด
            </h3>
            
            <div className="space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    {downloadProgress.current} / {downloadProgress.total} ไฟล์
                  </span>
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    {Math.round((downloadProgress.current / downloadProgress.total) * 100)}%
                  </span>
                </div>
                <div className={`w-full h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}>
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                  />
                </div>
              </div>

              {/* Cancel button */}
              <button
                onClick={() => {
                  downloadCancelledRef.current = true;
                  setDownloadProgress(prev => prev ? { ...prev, cancelled: true } : null);
                }}
                className={`w-full px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-gray-900/80 border-gray-700'
                : 'bg-white/80 border-gray-200'
            }`}
          >
            <h3 className={`text-2xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              ⚙️ ตั้งค่า
            </h3>

            <div className="space-y-6">
              {/* Images per page setting */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  จำนวนรูปต่อหน้า
                </label>
                <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  ค่าเริ่มต้น: 12 รูป
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[8, 12, 16, 20, 24, 32].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setImagesPerPage(num);
                        localStorage.setItem('imagesPerPage', num.toString());
                        setCurrentPage(1);
                      }}
                      className={`px-4 py-3 rounded-xl font-medium transition-all relative ${
                        imagesPerPage === num
                          ? theme === 'dark'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span>{num}</span>
                      {num === 12 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-green-500 text-white rounded">
                          DEFAULT
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme setting */}
              <div>
                <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  ธีม
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setTheme('light');
                      localStorage.setItem('theme', 'light');
                    }}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      theme === 'light'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    ☀️ สว่าง
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark');
                      localStorage.setItem('theme', 'dark');
                    }}
                    className={`px-4 py-3 rounded-xl font-medium transition-all ${
                      theme === 'dark'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    🌙 มืด
                  </button>
                </div>
              </div>

              {/* User name */}
              {userName && (
                <div>
                  <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                    ชื่อผู้ใช้
                  </label>
                  {editingName ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="ชื่อใหม่..."
                        autoFocus
                        className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                            : 'bg-white border-gray-300 text-black placeholder-gray-400'
                        }`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (newUserName.trim()) {
                              setUserName(newUserName.trim());
                              localStorage.setItem('userName', newUserName.trim());
                              setEditingName(false);
                              setNewUserName('');
                            }
                          }}
                          disabled={!newUserName.trim()}
                          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            !newUserName.trim()
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          } ${
                            theme === 'dark'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={() => {
                            setEditingName(false);
                            setNewUserName('');
                          }}
                          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            theme === 'dark'
                              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div
                        className={`flex-1 px-4 py-3 rounded-xl ${
                          theme === 'dark'
                            ? 'bg-gray-800 text-gray-300'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {userName}
                      </div>
                      <button
                        onClick={() => {
                          setEditingName(true);
                          setNewUserName(userName);
                        }}
                        className={`px-4 py-3 rounded-xl font-medium transition-all ${
                          theme === 'dark'
                            ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        แก้ไข
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className={`w-full mt-6 px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-white text-black hover:bg-gray-200'
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Name Prompt Modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-gray-900/80 border-gray-700'
                : 'bg-white/80 border-gray-200'
            }`}
          >
            <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              ยินดีต้อนรับ! 👋
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              กรุณาใส่ชื่อเล่นของคุณเพื่อเริ่มใช้งาน (ใช้ได้ทั้งภาษาไทยและอังกฤษ)
            </p>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="ชื่อเล่นของคุณ..."
              autoFocus
              className={`w-full px-4 py-3 rounded-xl border outline-none transition-all ${
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                  : 'bg-white border-gray-300 text-black placeholder-gray-400'
              }`}
            />
            {userName && /[\u0E00-\u0E7F]/.test(userName) && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${theme === 'dark' ? 'bg-blue-900/20 text-blue-300 border border-blue-700/30' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium">ชื่อของคุณจะถูกแปลงเป็น: <span className="font-bold">{transliterateThaiToEng(userName)}</span></p>
                    <p className="mt-1 opacity-80">เพื่อความเข้ากันได้กับระบบ (แต่จะแสดงชื่อภาษาไทยตามปกติ)</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleNameSubmit}
                disabled={!userName.trim()}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                  !userName.trim()
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                } ${
                  theme === 'dark'
                    ? 'bg-white text-black hover:bg-gray-200'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                ยืนยัน
              </button>
              {/* แสดงปุ่มยกเลิกเฉพาะเมื่อมีไฟล์รออยู่ (ไม่ใช่ครั้งแรก) */}
              {pendingFilesRef.current && (
                <button
                  onClick={() => {
                    setShowNamePrompt(false);
                    pendingFilesRef.current = null; // ล้างไฟล์ที่รออยู่
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-gray-200 text-black hover:bg-gray-300'
                  }`}
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all ${
          theme === 'dark'
            ? 'bg-gray-900/70 border-gray-800'
            : 'bg-white/70 border-gray-200'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                M or new Gallery
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {userName && (
                <span
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  ชื่อผู้ใช้ {userName}
                </span>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                ⚙️
              </button>
              <button
                onClick={() => {
                  const newTheme = theme === 'light' ? 'dark' : 'light';
                  setTheme(newTheme);
                  localStorage.setItem('theme', newTheme);
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Upload Section */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-12 rounded-3xl border-2 border-dashed backdrop-blur-xl transition-all overflow-hidden ${
            isDragging
              ? theme === 'dark'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-blue-600 bg-blue-600/10'
              : theme === 'dark'
              ? 'bg-gray-900/50 border-gray-700'
              : 'bg-white/50 border-gray-300'
          }`}
        >
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = '';
            }}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`block cursor-pointer ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            {uploading ? (
              <div className="py-16 px-8 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div
                    className={`absolute inset-0 border-4 rounded-full ${
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  />
                  <div
                    className={`absolute inset-0 border-4 border-transparent rounded-full animate-spin ${
                      theme === 'dark' ? 'border-t-blue-500' : 'border-t-blue-600'
                    }`}
                    style={{ borderTopWidth: '4px' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      {uploadProgress}%
                    </span>
                  </div>
                </div>
                <p className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  กำลังอัปโหลด...
                </p>
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {uploadCount.total > 0 && `${uploadCount.current}/${uploadCount.total} ไฟล์`}
                </p>
              </div>
            ) : (
              <div className="py-16 px-8">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div
                    className={`w-32 h-32 rounded-3xl flex items-center justify-center text-7xl font-light transition-all leading-none ${
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-400'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                    style={{ lineHeight: '0' }}
                  >
                    +
                  </div>
                  <div className="space-y-3">
                    <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                      อัปโหลดรูปภาพ
                    </h3>
                    <p className={`text-base ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      คลิกหรือลากไฟล์มาวางที่นี่
                    </p>
                    <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-yellow-900/20 text-yellow-300 border border-yellow-700/30' : 'bg-yellow-100 text-yellow-800 border border-yellow-300'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>รูปที่ไม่เกี่ยวข้องกับเอ็มออนิวจะถูกลบภายใน 1-3 วัน</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Gallery */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                Gallery
              </h2>
              <span
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  theme === 'dark'
                    ? 'bg-gray-900/50 text-gray-300 border border-gray-800'
                    : 'bg-white/50 text-gray-700 border border-gray-200'
                }`}
              >
                {images.length} Photos
              </span>
            </div>
            
            {images.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>ดาวน์โหลดทั้งหมด</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton aspect-square rounded-2xl"></div>
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex flex-col items-center space-y-6">
                <svg
                  className="w-32 h-32 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="space-y-4 max-w-md">
                  <p className={`text-base ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                    Upload your first photo to get started!
                  </p>
                  <div className={`mt-4 p-4 rounded-lg ${theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-700/30' : 'bg-yellow-100 border border-yellow-300'}`}>
                    <div className="flex items-start space-x-3">
                      <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className={`text-sm text-left ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        <strong>คำเตือน:</strong> รูปภาพที่ไม่เกี่ยวข้องกับเอ็มออนิวจะถูกลบออกอัตโนมัติภายใน 1-3 วัน
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {images
                  .slice((currentPage - 1) * imagesPerPage, currentPage * imagesPerPage)
                  .map((image) => (
                    <div
                      key={image.id}
                      className={`group relative rounded-2xl overflow-hidden border backdrop-blur-xl transition-all ${
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-800 hover:bg-gray-900/70'
                          : 'bg-white/50 border-gray-200 hover:bg-white/70'
                      }`}
                    >
                      <div 
                        className="aspect-square overflow-hidden cursor-pointer"
                        onClick={() => setViewImage(image)}
                      >
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="absolute top-3 right-3 z-10 flex gap-2">
                        {/* Download button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadImage(image);
                          }}
                          className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>

                        {/* Delete button - แสดงเฉพาะรูปของตนเอง */}
                        {image.uploader_name === userName && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(image);
                            }}
                            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg cursor-pointer"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Download Progress Overlay */}
                      {downloadingImageId !== null && downloadingImageId === image.id && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 pointer-events-none">
                          <div className="w-3/4 space-y-3">
                            <div className="relative w-16 h-16 mx-auto">
                              <svg className="w-16 h-16 transform -rotate-90">
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  className="text-gray-700"
                                />
                                <circle
                                  cx="32"
                                  cy="32"
                                  r="28"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  fill="none"
                                  strokeDasharray={`${2 * Math.PI * 28}`}
                                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - imageDownloadProgress / 100)}`}
                                  className="text-blue-500 transition-all duration-300"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white text-sm font-bold">{imageDownloadProgress}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${imageDownloadProgress}%` }}
                              />
                            </div>
                            <p className="text-white text-xs text-center">กำลังดาวน์โหลด...</p>
                          </div>
                        </div>
                      )}

                      {/* Text overlay - แสดงตลอดเวลา */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 transition-opacity pointer-events-none">
                        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1">
                          <p className="text-white text-sm font-medium drop-shadow-lg">จากผู้ใช้ {image.uploader_name}</p>
                          <p className="text-white/90 text-xs drop-shadow-lg">
                            {new Date(image.created_at).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Pagination */}
              {Math.ceil(images.length / imagesPerPage) > 1 && (
                <div className="flex justify-center mt-12">
                  <div className="join">
                    <button
                      className={`join-item btn border-none ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      «
                    </button>
                    <button
                      className={`join-item btn border-none cursor-default ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      หน้า {currentPage} / {Math.ceil(images.length / imagesPerPage)}
                    </button>
                    <button
                      className={`join-item btn border-none ${
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } ${
                        currentPage === Math.ceil(images.length / imagesPerPage)
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                      onClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(prev + 1, Math.ceil(images.length / imagesPerPage))
                        )
                      }
                      disabled={currentPage === Math.ceil(images.length / imagesPerPage)}
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`
            px-6 py-4 rounded-lg shadow-2xl flex items-center space-x-3 min-w-[300px]
            ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}
          `}>
            <div className="flex-shrink-0">
              {toast.type === 'success' && (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <p className="text-white font-medium">{toast.message}</p>
            <button
              onClick={() => setToast(null)}
              className="flex-shrink-0 ml-4 text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
