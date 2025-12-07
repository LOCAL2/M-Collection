import { supabase } from './supabase';

interface DuplicateGroup {
  filename: string;
  file_size: number;
  images: Array<{
    id: string;
    uploader_name: string;
    created_at: string;
    url: string;
  }>;
}

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1447052953956385002/6HvSIISCOk1GtW56_SIhu49AKVgZEVccoSKLjlKjclPjS_qZp63oVTHdSGqyj-WZF3fM';

export async function detectAndReportDuplicates() {
  try {
    // ดึงข้อมูลรูปทั้งหมด
    const { data: images, error } = await supabase
      .from('images')
      .select('id, filename, file_size, uploader_name, created_at, url')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!images || images.length === 0) return;

    // จัดกลุ่มรูปที่มีชื่อและขนาดเหมือนกัน
    const groupedByFile = new Map<string, typeof images>();
    
    images.forEach(img => {
      const key = `${img.filename}_${img.file_size}`;
      if (!groupedByFile.has(key)) {
        groupedByFile.set(key, []);
      }
      groupedByFile.get(key)!.push(img);
    });

    // หารูปที่ซ้ำ (มีมากกว่า 1 รูป)
    const duplicates: DuplicateGroup[] = [];
    
    groupedByFile.forEach((imgs) => {
      if (imgs.length > 1) {
        duplicates.push({
          filename: imgs[0].filename,
          file_size: imgs[0].file_size,
          images: imgs.map(img => ({
            id: img.id,
            uploader_name: img.uploader_name || 'Unknown',
            created_at: img.created_at,
            url: img.url
          }))
        });
      }
    });

    if (duplicates.length === 0) {
      console.log('No duplicates found');
      return;
    }

    // สร้างรายงานสำหรับ Discord
    await sendDuplicateReportToDiscord(duplicates);
    
    return duplicates;
  } catch (error) {
    console.error('Error detecting duplicates:', error);
    throw error;
  }
}

async function sendDuplicateReportToDiscord(duplicates: DuplicateGroup[]) {
  const totalDuplicates = duplicates.reduce((sum, group) => sum + group.images.length, 0);
  const totalGroups = duplicates.length;

  // สร้าง embed สำหรับ Discord
  const embeds = [];
  
  // Embed หลัก - สรุป
  embeds.push({
    title: '🔍 รายงานรูปภาพซ้ำ',
    description: `พบรูปภาพซ้ำทั้งหมด **${totalDuplicates}** รูป ใน **${totalGroups}** กลุ่ม`,
    color: 0xff6b6b,
    timestamp: new Date().toISOString(),
    footer: {
      text: 'M or new Gallery - Duplicate Detection System'
    }
  });

  // สร้าง embed สำหรับแต่ละกลุ่มรูปซ้ำ (จำกัด 10 กลุ่มแรก)
  for (let i = 0; i < Math.min(duplicates.length, 10); i++) {
    const group = duplicates[i];
    
    // เรียงตามวันที่ (เก่าสุดก่อน)
    const sortedImages = [...group.images].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // รูปแรก (เก่าสุด) = ต้นฉบับ, รูปที่เหลือ = ซ้ำ
    const original = sortedImages[0];
    const duplicateImages = sortedImages.slice(1);

    // สร้าง SQL command สำหรับลบรูปซ้ำ
    const deleteIds = duplicateImages.map(img => `'${img.id}'`).join(', ');
    const sqlCommand = `-- ลบรูปซ้ำของไฟล์: ${group.filename}\nDELETE FROM images WHERE id IN (${deleteIds});`;

    const fields = [
      {
        name: '📁 ชื่อไฟล์',
        value: `\`${group.filename}\``,
        inline: false
      },
      {
        name: '💾 ขนาดไฟล์',
        value: `${(group.file_size / 1024 / 1024).toFixed(2)} MB`,
        inline: true
      },
      {
        name: '🔢 จำนวนซ้ำ',
        value: `${group.images.length} รูป`,
        inline: true
      },
      {
        name: '✅ ต้นฉบับ (เก็บไว้)',
        value: `ID: \`${original.id}\`\nผู้อัปโหลด: **${original.uploader_name}**\nวันที่: ${new Date(original.created_at).toLocaleString('th-TH')}`,
        inline: false
      }
    ];

    // เพิ่มรายการรูปซ้ำ
    duplicateImages.forEach((img, idx) => {
      fields.push({
        name: `❌ รูปซ้ำ #${idx + 1} (ควรลบ)`,
        value: `ID: \`${img.id}\`\nผู้อัปโหลด: **${img.uploader_name}**\nวันที่: ${new Date(img.created_at).toLocaleString('th-TH')}`,
        inline: false
      });
    });

    // เพิ่ม SQL command
    fields.push({
      name: '💻 SQL Command สำหรับลบ',
      value: `\`\`\`sql\n${sqlCommand}\n\`\`\``,
      inline: false
    });

    embeds.push({
      title: `📸 กลุ่มที่ ${i + 1}: ${group.filename}`,
      color: 0xfeca57,
      fields: fields,
      thumbnail: {
        url: original.url
      }
    });
  }

  if (duplicates.length > 10) {
    embeds.push({
      title: '⚠️ มีรูปซ้ำเพิ่มเติม',
      description: `มีอีก ${duplicates.length - 10} กลุ่มที่ไม่แสดงในรายงานนี้`,
      color: 0xffa502
    });
  }

  // ส่งไป Discord (แบ่งเป็น batch ถ้ามีเยอะ)
  const EMBEDS_PER_MESSAGE = 10;
  for (let i = 0; i < embeds.length; i += EMBEDS_PER_MESSAGE) {
    const batch = embeds.slice(i, i + EMBEDS_PER_MESSAGE);
    
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: batch
      })
    });

    // รอ 1 วินาทีระหว่าง batch เพื่อไม่ให้โดน rate limit
    if (i + EMBEDS_PER_MESSAGE < embeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`Sent duplicate report to Discord: ${totalGroups} groups, ${totalDuplicates} images`);
}

// ฟังก์ชันสำหรับเรียกใช้งานอัตโนมัติ
export function startDuplicateDetection(intervalMinutes: number = 60) {
  // เช็คทันทีเมื่อเริ่มต้น
  detectAndReportDuplicates();
  
  // เช็คทุกๆ X นาที
  const intervalMs = intervalMinutes * 60 * 1000;
  return setInterval(() => {
    detectAndReportDuplicates();
  }, intervalMs);
}
