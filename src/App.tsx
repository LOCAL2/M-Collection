import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase, type Image } from './lib/supabase';
import { compressImage } from './lib/imageOptimizer';
import LazyImage from './components/LazyImage';

const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const RealFakeGuide = lazy(() => import('./pages/RealFakeGuide'));

// ฟังก์ชัน smooth scroll ที่ทำงานได้ทุก browser
const smoothScrollTo = (targetY: number) => {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const duration = 500; // milliseconds
  let start: number | null = null;

  const step = (timestamp: number) => {
    if (!start) start = timestamp;
    const progress = timestamp - start;
    const percent = Math.min(progress / duration, 1);
    
    // Easing function (ease-in-out)
    const ease = percent < 0.5
      ? 4 * percent * percent * percent
      : 1 - Math.pow(-2 * percent + 2, 3) / 2;
    
    window.scrollTo(0, startY + distance * ease);
    
    if (progress < duration) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

function App() {
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
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
  const [pendingUploads, setPendingUploads] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showReportPage, setShowReportPage] = useState(false);
  const [selectedOriginal, setSelectedOriginal] = useState<Image | null>(null);
  const [selectedDuplicate, setSelectedDuplicate] = useState<Image | null>(null);
  const [reportReason, setReportReason] = useState<'duplicate' | 'inappropriate'>('duplicate');
  const [showApiDocs, setShowApiDocs] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showRealFakeGuide, setShowRealFakeGuide] = useState(false);
  
  // ฟังก์ชันอัปเดต URL
  const updateURL = (page: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    window.history.pushState({}, '', url.toString());
    
    // Scroll ไปด้านบนเมื่อเปลี่ยนหน้า (ใช้ custom smooth scroll)
    smoothScrollTo(0);
  };

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

    // อ่าน URL parameters
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    const reportParam = params.get('report');
    
    if (pageParam) {
      const pageNum = parseInt(pageParam);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
    }

    // เช็คว่าเปิดหน้า Report หรือไม่
    if (reportParam === 'true') {
      setShowReportPage(true);
    }

    // เช็คว่าเปิดหน้า API Docs หรือไม่
    const apiParam = params.get('api');
    if (apiParam === 'true') {
      setShowApiDocs(true);
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme);

    const savedName = localStorage.getItem('userName');
    const savedUserId = localStorage.getItem('userId');
    
    if (savedName && savedUserId) {
      setUserName(savedName);
      setUserId(savedUserId);
      
      // เช็คว่ามี pending uploads หรือไม่
      const savedPendingUploads = localStorage.getItem('pendingUploads');
      if (savedPendingUploads) {
        try {
          const uploads = JSON.parse(savedPendingUploads);
          if (uploads.length > 0) {
            setPendingUploads(uploads);
            setShowResumePrompt(true);
          }
        } catch (e) {
          console.error('Error parsing pending uploads:', e);
          localStorage.removeItem('pendingUploads');
        }
      }
    } else {
      // ถ้ายังไม่มีชื่อ บังคับให้ใส่ชื่อทันที
      setShowNamePrompt(true);
    }

    fetchImages();
    const unsubscribe = subscribeToChanges();

    // Polling ทุก 30 วินาที (ลดจาก 100ms เพื่อประหยัด bandwidth)
    // Realtime subscription จะจัดการ update แบบ real-time อยู่แล้ว
    const pollingInterval = setInterval(() => {
      fetchImages();
    }, 30000);

    return () => {
      clearInterval(pollingInterval);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ซ่อน scroll ของ body เมื่อเปิด modal full-screen
  useEffect(() => {
    if (showApiDocs || showReportPage || showRealFakeGuide) {
      document.documentElement.classList.add('modal-open');
    } else {
      document.documentElement.classList.remove('modal-open');
    }
    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [showApiDocs, showReportPage, showRealFakeGuide]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle paste event for uploading images from clipboard (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // ถ้ากำลัง focus อยู่ใน input/textarea ให้ข้าม
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // สร้างชื่อไฟล์ใหม่ถ้าเป็น blob
            const timestamp = Date.now();
            const ext = item.type.split('/')[1] || 'png';
            const newFile = new File([file], `pasted-image-${timestamp}.${ext}`, { type: item.type });
            imageFiles.push(newFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        // สร้าง FileList-like object
        const dataTransfer = new DataTransfer();
        imageFiles.forEach(file => dataTransfer.items.add(file));
        handleUpload(dataTransfer.files);
        
        setToast({
          message: `กำลังอัปโหลด ${imageFiles.length} รูปจาก clipboard...`,
          type: 'info'
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [userName, uploading]);

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

  const handleUpload = async (files: FileList | null, resumeMode = false) => {
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

    // บันทึก pending uploads ลง localStorage
    if (!resumeMode) {
      const pendingData = validFiles.map(f => ({ name: f.name, size: f.size, type: f.type }));
      localStorage.setItem('pendingUploads', JSON.stringify(pendingData));
    }

    try {
      // Compress รูปก่อน upload เพื่อให้เร็วขึ้น
      setToast({ message: 'กำลังบีบอัดรูปภาพ...', type: 'info' });
      const compressedFiles = await Promise.all(
        validFiles.map(file => compressImage(file, 1920, 1920, 0.85))
      );

      const safeUserName = transliterateThaiToEng(userName) || 'user';
      let completedCount = 0;
      let skippedCount = 0;
      const totalFiles = compressedFiles.length;

      // Upload แบบ parallel (5 ไฟล์พร้อมกัน - เพิ่มจาก 3)
      const BATCH_SIZE = 5;
      const newImages: Image[] = [];

      for (let i = 0; i < compressedFiles.length; i += BATCH_SIZE) {
        const batch = compressedFiles.slice(i, i + BATCH_SIZE);
        
        const uploadPromises = batch.map(async (file) => {
          try {
            // เช็คว่ามีไฟล์ซ้ำใน database หรือไม่
            const { data: existingImages } = await supabase
              .from('images')
              .select('id')
              .eq('filename', file.name)
              .eq('file_size', file.size)
              .eq('mime_type', file.type)
              .eq('uploader_name', userName)
              .limit(1);

            if (existingImages && existingImages.length > 0) {
              console.log(`Skipping duplicate: ${file.name}`);
              return { success: true, skipped: true };
            }

            // สร้างชื่อไฟล์ที่ไม่ซ้ำ
            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 11);
            const fileName = `${timestamp}-${random}.${fileExt}`;
            const filePath = `${safeUserName}/${fileName}`;

            // Upload ไฟล์
            const { error: uploadError } = await supabase.storage
              .from('gallery-images')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              if (uploadError.message.includes('already exists')) {
                return { success: true, skipped: true };
              }
              throw uploadError;
            }

            // ดึง URL
            const { data: urlData } = supabase.storage
              .from('gallery-images')
              .getPublicUrl(filePath);

            // บันทึกข้อมูลลง database
            const { data: insertedData, error: dbError } = await supabase
              .from('images')
              .insert({
                filename: file.name,
                storage_path: filePath,
                url: urlData.publicUrl,
                uploader_name: userName,
                user_id: userId,
                file_size: file.size,
                mime_type: file.type,
              })
              .select()
              .single();

            if (dbError) throw dbError;

            return { success: true, data: insertedData, skipped: false };
          } catch (error) {
            console.error(`Error uploading ${file.name}:`, error);
            return { success: false, error, skipped: false };
          }
        });

        const results = await Promise.all(uploadPromises);
        
        results.forEach(result => {
          if (result.success) {
            completedCount++;
            if (result.skipped) {
              skippedCount++;
            } else if (result.data) {
              newImages.push(result.data);
            }
          }
        });

        // อัปเดต progress
        const progress = Math.floor((completedCount / totalFiles) * 100);
        setUploadProgress(progress);
        setUploadCount({ current: completedCount, total: totalFiles });
      }

      // เพิ่มรูปใหม่เข้า state ทันที
      if (newImages.length > 0) {
        setImages((prev) => [...newImages, ...prev]);
      }

      setUploadProgress(100);
      
      // ลบ pending uploads ออกจาก localStorage
      localStorage.removeItem('pendingUploads');
      
      // แสดงผลลัพธ์
      const uploadedCount = newImages.length;
      if (skippedCount > 0) {
        setToast({
          message: `อัปโหลดสำเร็จ ${uploadedCount} ไฟล์ • ข้าม ${skippedCount} ไฟล์ที่ซ้ำ`,
          type: 'info'
        });
      } else {
        setToast({
          message: `อัปโหลดสำเร็จ ${uploadedCount} ไฟล์`,
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



  const getImagePosition = (imageId: string) => {
    const index = images.findIndex(img => img.id === imageId);
    if (index === -1) return { page: 0, position: 0, total: 0 };
    
    const position = index + 1;
    const page = Math.ceil(position / imagesPerPage);
    const positionInPage = ((index % imagesPerPage) + 1);
    
    return {
      page,
      position,
      positionInPage,
      total: images.length
    };
  };

  const handleReportSubmit = async () => {
    // ส่ง webhook แบบไม่รอ response (fire and forget)
    setToast({
      message: 'กำลังส่งรายงาน...',
      type: 'info'
    });

    const sendReport = async () => {
      try {
        if (reportReason === 'duplicate' && selectedOriginal && selectedDuplicate) {
          // รายงานรูปซ้ำ
          const originalPos = getImagePosition(selectedOriginal.id);
          const duplicatePos = getImagePosition(selectedDuplicate.id);

          const reportData = {
            embeds: [
              // Embed 1: Header
              {
                title: '🔄 รายงานรูปซ้ำจากผู้ใช้',
                description: `**ผู้แจ้ง:** ${userName}\n**วันที่:** ${new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`,
                color: 0xfeca57,
                timestamp: new Date().toISOString(),
                footer: {
                  text: 'M or new Gallery - Duplicate Report System'
                }
              },
              // Embed 2: รูปต้นฉบับ (ฝั่งซ้าย)
              {
                title: '✅ รูปต้นฉบับ (เก็บไว้)',
                color: 0x22c55e,
                fields: [
                  {
                    name: '📁 ชื่อไฟล์',
                    value: `\`${selectedOriginal.filename}\``,
                    inline: false
                  },
                  {
                    name: '💾 ขนาด',
                    value: `${(selectedOriginal.file_size! / 1024 / 1024).toFixed(2)} MB`,
                    inline: true
                  },
                  {
                    name: '📤 ผู้อัปโหลด',
                    value: `**${selectedOriginal.uploader_name}**`,
                    inline: true
                  },
                  {
                    name: '📅 วันที่อัปโหลด',
                    value: new Date(selectedOriginal.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
                    inline: false
                  },
                  {
                    name: '📍 ตำแหน่งในแกลเลอรี่',
                    value: `หน้า **${originalPos.page}** | รูปที่ **${originalPos.position}**/**${originalPos.total}** | ลำดับในหน้า: **${originalPos.positionInPage}**`,
                    inline: false
                  },
                  {
                    name: '🆔 Image ID',
                    value: `\`${selectedOriginal.id}\``,
                    inline: false
                  },
                  {
                    name: '🔗 URL',
                    value: selectedOriginal.url,
                    inline: false
                  }
                ],
                image: {
                  url: selectedOriginal.url
                }
              },
              // Embed 3: รูปซ้ำ (ฝั่งขวา)
              {
                title: '❌ รูปซ้ำ (ควรลบ)',
                color: 0xef4444,
                fields: [
                  {
                    name: '📁 ชื่อไฟล์',
                    value: `\`${selectedDuplicate.filename}\``,
                    inline: false
                  },
                  {
                    name: '💾 ขนาด',
                    value: `${(selectedDuplicate.file_size! / 1024 / 1024).toFixed(2)} MB`,
                    inline: true
                  },
                  {
                    name: '📤 ผู้อัปโหลด',
                    value: `**${selectedDuplicate.uploader_name}**`,
                    inline: true
                  },
                  {
                    name: '📅 วันที่อัปโหลด',
                    value: new Date(selectedDuplicate.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
                    inline: false
                  },
                  {
                    name: '📍 ตำแหน่งในแกลเลอรี่',
                    value: `หน้า **${duplicatePos.page}** | รูปที่ **${duplicatePos.position}**/**${duplicatePos.total}** | ลำดับในหน้า: **${duplicatePos.positionInPage}**`,
                    inline: false
                  },
                  {
                    name: '🆔 Image ID',
                    value: `\`${selectedDuplicate.id}\``,
                    inline: false
                  },
                  {
                    name: '🔗 URL',
                    value: selectedDuplicate.url,
                    inline: false
                  }
                ],
                image: {
                  url: selectedDuplicate.url
                }
              },
              // Embed 4: SQL Command
              {
                title: '💻 SQL Command สำหรับลบรูปซ้ำ',
                description: `\`\`\`sql\n-- ลบรูปซ้ำ (ID: ${selectedDuplicate.id})\nDELETE FROM images WHERE id = '${selectedDuplicate.id}';\n\`\`\``,
                color: 0x8b5cf6,
                footer: {
                  text: 'คัดลอก SQL command ด้านบนไปรันใน Supabase SQL Editor'
                }
              }
            ]
          };

          // ส่งแบบไม่รอ response
          fetch('https://discord.com/api/webhooks/1447052953956385002/6HvSIISCOk1GtW56_SIhu49AKVgZEVccoSKLjlKjclPjS_qZp63oVTHdSGqyj-WZF3fM', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData),
            keepalive: true
          }).catch(err => console.error('Webhook error:', err));

        } else if (reportReason === 'inappropriate' && selectedDuplicate) {
          // รายงานรูปไม่เหมาะสม
          const imagePos = getImagePosition(selectedDuplicate.id);

          const reportData = {
            embeds: [
              // Embed 1: Header
              {
                title: '❌ รายงานรูปไม่เหมาะสมจากผู้ใช้',
                description: `**ผู้แจ้ง:** ${userName}\n**วันที่:** ${new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}\n**เหตุผล:** รูปไม่เกี่ยวข้องกับเอ็มออนิว`,
                color: 0xff6b6b,
                timestamp: new Date().toISOString(),
                footer: {
                  text: 'M or new Gallery - Inappropriate Content Report'
                }
              },
              // Embed 2: รูปที่ถูกรายงาน
              {
                title: '🚫 รูปที่ถูกรายงาน',
                color: 0xef4444,
                fields: [
                  {
                    name: '📁 ชื่อไฟล์',
                    value: `\`${selectedDuplicate.filename}\``,
                    inline: false
                  },
                  {
                    name: '� ขน*าด',
                    value: `${(selectedDuplicate.file_size! / 1024 / 1024).toFixed(2)} MB`,
                    inline: true
                  },
                  {
                    name: '📤 ผู้อัปโหลด',
                    value: `**${selectedDuplicate.uploader_name}**`,
                    inline: true
                  },
                  {
                    name: '📅 วันที่อัปโหลด',
                    value: new Date(selectedDuplicate.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }),
                    inline: false
                  },
                  {
                    name: '📍 ตำแหน่งในแกลเลอรี่',
                    value: `หน้า **${imagePos.page}** | รูปที่ **${imagePos.position}**/**${imagePos.total}** | ลำดับในหน้า: **${imagePos.positionInPage}**`,
                    inline: false
                  },
                  {
                    name: '🆔 Image ID',
                    value: `\`${selectedDuplicate.id}\``,
                    inline: false
                  },
                  {
                    name: '🔗 URL',
                    value: selectedDuplicate.url,
                    inline: false
                  }
                ],
                image: {
                  url: selectedDuplicate.url
                }
              },
              // Embed 3: SQL Command
              {
                title: '💻 SQL Command สำหรับลบ',
                description: `\`\`\`sql\n-- ลบรูปไม่เหมาะสม (ID: ${selectedDuplicate.id})\nDELETE FROM images WHERE id = '${selectedDuplicate.id}';\n\`\`\``,
                color: 0x8b5cf6,
                footer: {
                  text: 'คัดลอก SQL command ด้านบนไปรันใน Supabase SQL Editor'
                }
              }
            ]
          };

          // ส่งแบบไม่รอ response
          fetch('https://discord.com/api/webhooks/1447052953956385002/6HvSIISCOk1GtW56_SIhu49AKVgZEVccoSKLjlKjclPjS_qZp63oVTHdSGqyj-WZF3fM', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData),
            keepalive: true
          }).catch(err => console.error('Webhook error:', err));
        }
      } catch (error) {
        console.error('Error preparing report:', error);
      }
    };

    // ส่งแบบ async ไม่รอ
    sendReport();

    // แสดง success ทันที
    setTimeout(() => {
      setToast({
        message: 'ส่งรายงานสำเร็จ ขอบคุณที่แจ้งให้ทราบ',
        type: 'success'
      });
    }, 300);

    // ปิด modal และ reset
    setShowReportPage(false);
    setSelectedOriginal(null);
    setSelectedDuplicate(null);
    setReportReason('duplicate');
    
    // ลบ report parameter ออกจาก URL
    const url = new URL(window.location.href);
    url.searchParams.delete('report');
    window.history.pushState({}, '', url.toString());
  };

  const handleNameSubmit = () => {
    if (userName.trim()) {
      // สร้าง unique user ID (ใช้ timestamp + random)
      const newUserId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      localStorage.setItem('userName', userName.trim());
      localStorage.setItem('userId', newUserId);
      setUserId(newUserId);
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

    setToast({
      message: 'กำลังเตรียมไฟล์ ZIP...',
      type: 'info'
    });

    try {
      // Import JSZip dynamically
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

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

          // เพิ่มไฟล์เข้า ZIP
          zip.file(image.filename, data);
          successCount++;
        } catch (error) {
          console.error(`Error downloading ${image.filename}:`, error);
          failCount++;
        }

        // อัปเดตความคืบหน้า
        setDownloadProgress(prev => 
          prev ? { ...prev, current: i + 1 } : null
        );
      }

      const wasCancelled = downloadCancelledRef.current;

      if (!wasCancelled && successCount > 0) {
        // สร้าง ZIP file
        setToast({
          message: 'กำลังสร้างไฟล์ ZIP...',
          type: 'info'
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // ดาวน์โหลด ZIP file
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gallery-images-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // ปิด modal
      setDownloadProgress(null);

      // แสดงผลลัพธ์
      if (wasCancelled) {
        setToast({
          message: `ยกเลิกการดาวน์โหลด`,
          type: 'info'
        });
      } else if (failCount === 0) {
        setToast({
          message: `ดาวน์โหลด ZIP สำเร็จ (${successCount} ไฟล์)`,
          type: 'success'
        });
      } else {
        setToast({
          message: `ดาวน์โหลด ZIP สำเร็จ ${successCount} ไฟล์ • ล้มเหลว ${failCount} ไฟล์`,
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Error creating ZIP:', error);
      setDownloadProgress(null);
      setToast({
        message: 'เกิดข้อผิดพลาดในการสร้าง ZIP',
        type: 'error'
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
          ? 'bg-transparent'
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
                <div className="grid grid-cols-4 gap-3">
                  {[8, 12, 16, 20, 24, 32, 48, -1].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setImagesPerPage(num === -1 ? 9999 : num);
                        localStorage.setItem('imagesPerPage', (num === -1 ? 9999 : num).toString());
                        setCurrentPage(1);
                        updateURL(1);
                      }}
                      className={`px-4 py-3 rounded-xl font-medium transition-all relative ${
                        (num === -1 ? imagesPerPage === 9999 : imagesPerPage === num)
                          ? theme === 'dark'
                            ? 'bg-blue-600 text-white'
                            : 'bg-blue-500 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span>{num === -1 ? 'All' : num}</span>
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

      {/* API Docs Page */}
      {showApiDocs && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
          <ApiDocs 
            userName={userName}
            userId={userId}
            onClose={() => {
              setShowApiDocs(false);
              const url = new URL(window.location.href);
              url.searchParams.delete('api');
              window.history.pushState({}, '', url.toString());
            }} 
          />
        </Suspense>
      )}

      {/* Real Fake Guide Page */}
      {showRealFakeGuide && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center"><div className="text-white">Loading...</div></div>}>
          <RealFakeGuide 
            onClose={() => {
              setShowRealFakeGuide(false);
              const url = new URL(window.location.href);
              url.searchParams.delete('guide');
              window.history.pushState({}, '', url.toString());
            }} 
          />
        </Suspense>
      )}

      {/* Report Page - Full Screen */}
      {showReportPage && (
        <div className="fixed inset-0 z-50 overflow-y-auto" style={{ backgroundColor: '#0f172a', backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="min-h-screen">
            {/* Header */}
            <div className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
              <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Report System</h1>
                    <p className="text-slate-400 text-sm">Select images to report inappropriate content or duplicates</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowReportPage(false);
                      setSelectedOriginal(null);
                      setSelectedDuplicate(null);
                      setReportReason('duplicate');
                      // ลบ report parameter ออกจาก URL
                      const url = new URL(window.location.href);
                      url.searchParams.delete('report');
                      window.history.pushState({}, '', url.toString());
                    }}
                    className="px-5 py-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-all cursor-pointer font-medium border border-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
              <div className="bg-slate-900/95 backdrop-blur-sm rounded-2xl border border-slate-800 p-6">
              {/* Report Type Selection */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Report Type</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setReportReason('duplicate');
                      setSelectedOriginal(null);
                      setSelectedDuplicate(null);
                    }}
                    className={`p-6 rounded-xl text-left transition-all border-2 ${
                      reportReason === 'duplicate'
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        reportReason === 'duplicate' ? 'bg-orange-700' : 'bg-slate-800'
                      }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold">Duplicate Images</p>
                        <p className="text-sm opacity-75">Report duplicate uploads</p>
                      </div>
                      {reportReason === 'duplicate' && (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs opacity-75">Select original image and duplicate to remove</p>
                  </button>

                  <button
                    onClick={() => {
                      setReportReason('inappropriate');
                      setSelectedOriginal(null);
                      setSelectedDuplicate(null);
                    }}
                    className={`p-6 rounded-xl text-left transition-all border-2 ${
                      reportReason === 'inappropriate'
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        reportReason === 'inappropriate' ? 'bg-red-700' : 'bg-slate-800'
                      }`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold">Inappropriate Content</p>
                        <p className="text-sm opacity-75">Report inappropriate images</p>
                      </div>
                      {reportReason === 'inappropriate' && (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs opacity-75">Select image that violates content policy</p>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="mb-8">
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-blue-300 text-sm font-medium mb-1">Instructions</p>
                      <p className="text-blue-200/80 text-sm">
                        {reportReason === 'duplicate' 
                          ? 'Click to select the original image (green border), then select the duplicate (red border), and submit the report.'
                          : 'Click to select the inappropriate image (red border) and submit the report.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Images Summary */}
              {(selectedOriginal || selectedDuplicate) && (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-white mb-4">Selected Images</h2>
                  <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    
                    {reportReason === 'duplicate' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Original Image */}
                        <div className={`p-5 rounded-lg border-2 transition-all ${
                          selectedOriginal 
                            ? 'bg-green-900/20 border-green-600' 
                            : 'bg-slate-800/50 border-slate-700 border-dashed'
                        }`}>
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${
                              selectedOriginal ? 'bg-green-600' : 'bg-slate-700'
                            }`}>
                              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-white font-semibold">Original (Keep)</span>
                          </div>
                          {selectedOriginal ? (
                            <div>
                              <img src={selectedOriginal.url} alt="" className="w-full h-40 object-cover rounded-lg mb-3" />
                              <div className="space-y-2 text-sm">
                                <p className="text-white truncate">{selectedOriginal.filename}</p>
                                <p className="text-slate-400">By {selectedOriginal.uploader_name}</p>
                                <p className="text-slate-500 text-xs">
                                  {new Date(selectedOriginal.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedOriginal(null)}
                                className="w-full mt-3 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all cursor-pointer"
                              >
                                Remove Selection
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <svg className="w-12 h-12 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-slate-400 text-sm">Click image below to select original</p>
                            </div>
                          )}
                        </div>

                        {/* Duplicate Image */}
                        <div className={`p-5 rounded-lg border-2 transition-all ${
                          selectedDuplicate 
                            ? 'bg-red-900/20 border-red-600' 
                            : 'bg-slate-800/50 border-slate-700 border-dashed'
                        }`}>
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${
                              selectedDuplicate ? 'bg-red-600' : 'bg-slate-700'
                            }`}>
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <span className="text-white font-semibold">Duplicate (Remove)</span>
                          </div>
                          {selectedDuplicate ? (
                            <div>
                              <img src={selectedDuplicate.url} alt="" className="w-full h-40 object-cover rounded-lg mb-3" />
                              <div className="space-y-2 text-sm">
                                <p className="text-white truncate">{selectedDuplicate.filename}</p>
                                <p className="text-slate-400">By {selectedDuplicate.uploader_name}</p>
                                <p className="text-slate-500 text-xs">
                                  {new Date(selectedDuplicate.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedDuplicate(null)}
                                className="w-full mt-3 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all cursor-pointer"
                              >
                                Remove Selection
                              </button>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <svg className="w-12 h-12 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className="text-slate-400 text-sm">Click image below to select duplicate</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Inappropriate Content */
                      <div className={`p-5 rounded-lg border-2 transition-all max-w-md mx-auto ${
                        selectedDuplicate 
                          ? 'bg-red-900/20 border-red-600' 
                          : 'bg-slate-800/50 border-slate-700 border-dashed'
                      }`}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-8 h-8 rounded flex items-center justify-center ${
                            selectedDuplicate ? 'bg-red-600' : 'bg-slate-700'
                          }`}>
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <span className="text-white font-semibold">Inappropriate Content</span>
                        </div>
                        {selectedDuplicate ? (
                          <div>
                            <img src={selectedDuplicate.url} alt="" className="w-full h-48 object-cover rounded-lg mb-3" />
                            <div className="space-y-2 text-sm">
                              <p className="text-white truncate">{selectedDuplicate.filename}</p>
                              <p className="text-slate-400">By {selectedDuplicate.uploader_name}</p>
                              <p className="text-slate-500 text-xs">
                                {new Date(selectedDuplicate.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedDuplicate(null)}
                              className="w-full mt-3 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-all cursor-pointer"
                            >
                              Remove Selection
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <svg className="w-12 h-12 mx-auto text-slate-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-slate-400 text-sm">Click image below to select</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Submit Button */}
                    <button
                      onClick={handleReportSubmit}
                      disabled={reportReason === 'duplicate' ? !selectedOriginal || !selectedDuplicate : !selectedDuplicate}
                      className={`w-full mt-6 px-6 py-3.5 rounded-lg font-semibold transition-all ${
                        (reportReason === 'duplicate' ? selectedOriginal && selectedDuplicate : selectedDuplicate)
                          ? reportReason === 'duplicate'
                            ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer'
                            : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                          : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      }`}
                    >
                      {(reportReason === 'duplicate' ? selectedOriginal && selectedDuplicate : selectedDuplicate) ? (
                        'Submit Report to Discord'
                      ) : (
                        'Select images to continue'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Image Grid */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">All Images</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {images.map((image, index) => {
                    const globalIndex = index + 1;
                    const page = Math.ceil(globalIndex / imagesPerPage);
                    const positionInPage = ((index % imagesPerPage) + 1);
                    const isOriginal = selectedOriginal?.id === image.id;
                    const isDuplicate = selectedDuplicate?.id === image.id;
                    
                    return (
                      <div
                        key={image.id}
                        onClick={() => {
                          if (reportReason === 'duplicate') {
                            if (!selectedOriginal) {
                              setSelectedOriginal(image);
                            } else if (!selectedDuplicate && image.id !== selectedOriginal.id) {
                              setSelectedDuplicate(image);
                            } else if (isOriginal) {
                              setSelectedOriginal(null);
                            } else if (isDuplicate) {
                              setSelectedDuplicate(null);
                            }
                          } else {
                            setSelectedDuplicate(isDuplicate ? null : image);
                          }
                        }}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all border-2 ${
                          isOriginal 
                            ? 'border-green-500 scale-95' 
                            : isDuplicate 
                            ? 'border-red-500 scale-95'
                            : 'border-transparent hover:border-slate-600'
                        }`}
                      >
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Badge */}
                        {isOriginal && (
                          <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold">
                            ORIGINAL
                          </div>
                        )}
                        {isDuplicate && (
                          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold">
                            {reportReason === 'duplicate' ? 'DUPLICATE' : 'FLAGGED'}
                          </div>
                        )}
                        
                        {/* Info Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <p className="text-white text-[10px] font-medium truncate">{image.uploader_name}</p>
                          <p className="text-white/60 text-[9px]">
                            Page {page} • #{globalIndex} • Pos {positionInPage}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resume Upload Modal */}
      {showResumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-md p-8 rounded-3xl border backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-gray-900/80 border-gray-700'
                : 'bg-white/80 border-gray-200'
            }`}
          >
            <h3 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              พบการอัปโหลดที่ค้างไว้ 📤
            </h3>
            <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              มีไฟล์ {pendingUploads.length} ไฟล์ที่ยังไม่ได้อัปโหลด คุณต้องการอัปโหลดต่อหรือไม่?
            </p>
            <div className={`mb-6 p-4 rounded-xl max-h-40 overflow-y-auto ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
              {pendingUploads.slice(0, 5).map((file, idx) => (
                <div key={idx} className={`text-sm py-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  • {file.name}
                </div>
              ))}
              {pendingUploads.length > 5 && (
                <div className={`text-sm py-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  และอีก {pendingUploads.length - 5} ไฟล์...
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResumePrompt(false);
                  localStorage.removeItem('pendingUploads');
                  setPendingUploads([]);
                }}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  setShowResumePrompt(false);
                  setToast({
                    message: 'กรุณาเลือกไฟล์เดิมอีกครั้งเพื่ออัปโหลดต่อ',
                    type: 'info'
                  });
                }}
                className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                อัปโหลดต่อ
              </button>
            </div>
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

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-3">
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
                onClick={() => {
                  setShowApiDocs(true);
                  const url = new URL(window.location.href);
                  url.searchParams.set('api', 'true');
                  window.history.pushState({}, '', url.toString());
                }}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                API
              </button>
              <button
                onClick={() => {
                  setShowReportPage(true);
                  const url = new URL(window.location.href);
                  url.searchParams.set('report', 'true');
                  window.history.pushState({}, '', url.toString());
                }}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-medium ${
                  theme === 'dark'
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                ⚠️ รายงาน
              </button>
              <button
                onClick={() => {
                  setShowRealFakeGuide(true);
                  const url = new URL(window.location.href);
                  url.searchParams.set('guide', 'true');
                  window.history.pushState({}, '', url.toString());
                }}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer font-medium ${
                  theme === 'dark'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                ✓ วิธีสังเกตของแท้
              </button>
              
              {/* Admin button - ซ่อนไว้ */}
              {userName === 'admin' && (
                <button
                  onClick={async () => {
                    setToast({ message: 'กำลังตรวจสอบรูปซ้ำ...', type: 'info' });
                    try {
                      const { detectAndReportDuplicates } = await import('./lib/duplicateDetector');
                      await detectAndReportDuplicates();
                      setToast({ message: 'ส่งรายงานรูปซ้ำไปยัง Discord แล้ว (Admin)', type: 'success' });
                    } catch (error) {
                      console.error('Error checking duplicates:', error);
                      setToast({ message: 'เกิดข้อผิดพลาดในการตรวจสอบรูปซ้ำ', type: 'error' });
                    }
                  }}
                  className={`p-2 rounded-xl transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-purple-500 text-white hover:bg-purple-600'
                  }`}
                  title="ตรวจสอบรูปซ้ำ (Admin)"
                >
                  🔍
                </button>
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

            {/* Mobile Hamburger Button */}
            <div className="flex md:hidden items-center gap-2">
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
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gray-800 text-white hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showMobileMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {showMobileMenu && (
            <div className={`md:hidden border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="px-4 py-3 space-y-2">
                {userName && (
                  <div className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    ชื่อผู้ใช้ {userName}
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowApiDocs(true);
                    setShowMobileMenu(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set('api', 'true');
                    window.history.pushState({}, '', url.toString());
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all cursor-pointer font-medium text-left ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  📚 API Documentation
                </button>
                <button
                  onClick={() => {
                    setShowReportPage(true);
                    setShowMobileMenu(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set('report', 'true');
                    window.history.pushState({}, '', url.toString());
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all cursor-pointer font-medium text-left ${
                    theme === 'dark'
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  ⚠️ รายงานรูปซ้ำ/ไม่เหมาะสม
                </button>
                <button
                  onClick={() => {
                    setShowRealFakeGuide(true);
                    setShowMobileMenu(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set('guide', 'true');
                    window.history.pushState({}, '', url.toString());
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all cursor-pointer font-medium text-left ${
                    theme === 'dark'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  ✓ วิธีสังเกตของแท้
                </button>
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl transition-all cursor-pointer font-medium text-left ${
                    theme === 'dark'
                      ? 'bg-gray-800 text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  ⚙️ ตั้งค่า
                </button>
              </div>
            </div>
          )}
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
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-blue-900/20 text-blue-300 border border-blue-700/30' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>รองรับ Copy-Paste รูปภาพ (Ctrl+V)</span>
                      </div>
                      <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs ${theme === 'dark' ? 'bg-yellow-900/20 text-yellow-300 border border-yellow-700/30' : 'bg-yellow-100 text-yellow-800 border border-yellow-300'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>รูปที่ไม่เกี่ยวข้องกับเอ็มออนิวจะถูกลบภายใน 1-3 ชั่วโมง</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </label>
        </div>

        {/* Gallery */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                คอลเล็กชันพรี่เอ็ม ออนิว
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
                      className={`group relative rounded-2xl overflow-hidden border-2 backdrop-blur-xl transition-all shadow-lg ${
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-slate-600/50 hover:border-blue-500/50 hover:shadow-blue-500/20'
                          : 'bg-white/50 border-gray-300 hover:border-blue-400 hover:shadow-blue-400/20'
                      }`}
                    >
                      <div
                        className="aspect-square overflow-hidden cursor-pointer"
                        onClick={() => setViewImage(image)}
                      >
                        <LazyImage
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-full transition-transform duration-500 group-hover:scale-110"
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



                        {/* Delete button - แสดงเฉพาะรูปของตนเอง (เช็คจาก user_id) */}
                        {image.user_id === userId && (
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
                      onClick={() => {
                        const newPage = Math.max(currentPage - 1, 1);
                        setCurrentPage(newPage);
                        updateURL(newPage);
                      }}
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
                      onClick={() => {
                        const newPage = Math.min(currentPage + 1, Math.ceil(images.length / imagesPerPage));
                        setCurrentPage(newPage);
                        updateURL(newPage);
                      }}
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
