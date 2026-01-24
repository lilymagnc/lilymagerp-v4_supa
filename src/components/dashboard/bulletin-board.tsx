import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useOrders } from '@/hooks/use-orders';
import { useCalendar } from '@/hooks/use-calendar';
import { format, isToday, startOfDay, isEqual, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getWeatherInfo, getWeatherEmoji } from '@/lib/weather-service';

const BulletinBoard = () => {
  const [boardData, setBoardData] = useState<string[]>([]);
  const [weatherLine, setWeatherLine] = useState("🌤️ 날씨 정보 로딩 중...");
  const { user } = useAuth();
  const { orders = [] } = useOrders();
  const { events = [] } = useCalendar();

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const role = user.role?.trim();
    const email = user.email?.toLowerCase();
    return (
      role === '본사 관리자' ||
      email === 'lilymag0301@gmail.com' ||
      (role && role.includes('본사') && role.includes('관리자'))
    );
  }, [user]);

  useEffect(() => {
    const fetchWeather = (latitude?: number, longitude?: number) => {
      getWeatherInfo(latitude, longitude).then(weatherInfo => {
        if (weatherInfo) {
          const emoji = getWeatherEmoji(weatherInfo.icon);
          setWeatherLine(`${emoji} ${weatherInfo.description}, 최저:${weatherInfo.minTemperature}°C / 최고:${weatherInfo.maxTemperature}°C`);
        } else {
          setWeatherLine("날씨 정보를 가져올 수 없습니다.");
        }
      });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          fetchWeather();
        }
      );
    } else {
      fetchWeather();
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const dateLine = format(new Date(), "M월 d일 (EEEE)", { locale: ko });
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      const todayString = format(today, 'yyyy-MM-dd');
      const tomorrowString = format(tomorrow, 'yyyy-MM-dd');

      const finalData = [dateLine, weatherLine];

      if (isAdmin) {
        const todayDeliveries = orders.filter(o => o.deliveryInfo?.date === todayString && o.status !== 'completed').length;
        const tomorrowDeliveries = orders.filter(o => o.deliveryInfo?.date === tomorrowString && o.status !== 'completed').length;
        const todayPickups = orders.filter(o => o.pickupInfo?.date === todayString && o.status !== 'completed').length;
        const tomorrowPickups = orders.filter(o => o.pickupInfo?.date === tomorrowString && o.status !== 'completed').length;
        finalData.push(`🚚 오늘/내일 배송: ${todayDeliveries}건 / ${tomorrowDeliveries}건`);
        finalData.push(`📦 오늘/내일 픽업: ${todayPickups}건 / ${tomorrowPickups}건`);
      } else if (user?.franchise) {
        const relevantOrders = orders.filter(o => o.branchName === user.franchise);
        const upcomingDeliveries = relevantOrders
          .filter(o => (o.deliveryInfo?.date === todayString || o.deliveryInfo?.date === tomorrowString) && o.status !== 'completed')
          .map(o => `🚚 [${o.deliveryInfo?.date === todayString ? '오늘' : '내일'}] ${o.deliveryInfo?.time || ''} 배송: ${o.orderer?.name || ''}`);
        const upcomingPickups = relevantOrders
          .filter(o => (o.pickupInfo?.date === todayString || o.pickupInfo?.date === tomorrowString) && o.status !== 'completed')
          .map(o => `📦 [${o.pickupInfo?.date === todayString ? '오늘' : '내일'}] ${o.pickupInfo?.time || ''} 픽업: ${o.orderer?.name || ''}`);
        finalData.push(...upcomingDeliveries, ...upcomingPickups);
      }

      const todayStart = startOfDay(new Date());
      const noticeLines = events
        .filter(event => {
          if (event.type !== 'notice') return false;
          const startDate = startOfDay(new Date(event.startDate));
          const endDate = event.endDate ? startOfDay(new Date(event.endDate)) : startDate;
          const active = (isEqual(todayStart, startDate) || isAfter(todayStart, startDate)) &&
            (isEqual(todayStart, endDate) || isBefore(todayStart, endDate));

          if (isAdmin) return active;
          return active && (event.branchName === '전체' || event.branchName === user?.franchise);
        })
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
        .slice(0, 5)
        .map(event => `📢 ${event.title}`);

      if (noticeLines.length === 0) {
        noticeLines.push("📢 오늘 등록된 공지사항이 없습니다.");
      }
      finalData.push(...noticeLines);

      setBoardData(finalData.filter(Boolean));
    };

    fetchData();
  }, [user, isAdmin, orders, events, weatherLine]);

  const displayData = [...boardData, ...boardData];

  return (
    <div className="h-20 w-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-2xl overflow-hidden relative flex items-center">
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      <div
        className="absolute w-max flex flex-row items-center animate-scroll-left"
        style={{ animationDuration: `${Math.max(60, boardData.length * 15)}s` }}
      >
        {displayData.map((item, index) => (
          <React.Fragment key={index}>
            <p
              className="text-white text-2xl font-bold whitespace-nowrap px-6"
              dangerouslySetInnerHTML={{
                __html: item.replace(/(오늘|내일|배송|픽업|건)/g, '<span class="text-yellow-300">$1</span>')
              }}
            />
            {index < boardData.length - 1 && <span className="text-white opacity-50 mx-4">|</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default BulletinBoard;
