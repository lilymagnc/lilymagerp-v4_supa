import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useOrders } from '@/hooks/use-orders';
import { useCalendar } from '@/hooks/use-calendar';
import { format, isToday, startOfDay, isEqual, isAfter, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getWeatherInfo, getWeatherEmoji } from '@/lib/weather-service';

// Helper function to get today and tomorrow's date strings
const getDates = () => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return {
    todayString: format(today, 'yyyy-MM-dd'),
    tomorrowString: format(tomorrow, 'yyyy-MM-dd'),
  };
};

const BulletinBoard = () => {
  const [boardData, setBoardData] = useState<string[]>([]);
  const [weatherLine, setWeatherLine] = useState("🌤️ 날씨 정보 로딩 중...");
  const { user } = useAuth();
  const { orders = [] } = useOrders();
  const { events = [] } = useCalendar();

  // Effect for fetching weather based on location
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
        (position) => { // Success
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        () => { // Error or permission denied
          fetchWeather(); // Fetch for default location (Seoul)
        }
      );
    } else {
      fetchWeather(); // Geolocation not supported
    }
  }, []); // Runs once on mount

  // Effect for building the main board data
  useEffect(() => {
    const fetchData = async () => {
      const dateLine = format(new Date(), "M월 d일 (EEEE)", { locale: ko });
      const { todayString, tomorrowString } = getDates();
      const finalData = [dateLine, weatherLine];

      if (user?.role === '본사 관리자') {
        const relevantOrders = orders;
        const todayDeliveries = relevantOrders.filter(o => o.deliveryInfo?.date === todayString && o.status !== 'completed').length;
        const tomorrowDeliveries = relevantOrders.filter(o => o.deliveryInfo?.date === tomorrowString && o.status !== 'completed').length;
        const todayPickups = relevantOrders.filter(o => o.pickupInfo?.date === todayString && o.status !== 'completed').length;
        const tomorrowPickups = relevantOrders.filter(o => o.pickupInfo?.date === tomorrowString && o.status !== 'completed').length;
        const deliveryLine = `🚚 오늘/내일 배송: ${todayDeliveries}건 / ${tomorrowDeliveries}건`;
        const pickupLine = `📦 오늘/내일 픽업: ${todayPickups}건 / ${tomorrowPickups}건`;
        finalData.push(deliveryLine, pickupLine);
      } else if (user?.franchise) {
        const relevantOrders = orders.filter(o => o.branchName === user.franchise);
        const upcomingDeliveries = relevantOrders
          .filter(o => (o.deliveryInfo?.date === todayString || o.deliveryInfo?.date === tomorrowString) && o.status !== 'completed')
          .sort((a, b) => (a.deliveryInfo?.time || '').localeCompare(b.deliveryInfo?.time || ''))
          .map(o => `🚚 [${o.deliveryInfo?.date === todayString ? '오늘' : '내일'}] ${o.deliveryInfo?.time || '시간미정'} 배송: ${o.orderer?.name || '정보없음'}`);
        const upcomingPickups = relevantOrders
          .filter(o => (o.pickupInfo?.date === todayString || o.pickupInfo?.date === tomorrowString) && o.status !== 'completed')
          .sort((a, b) => (a.pickupInfo?.time || '').localeCompare(b.pickupInfo?.time || ''))
          .map(o => `📦 [${o.pickupInfo?.date === todayString ? '오늘' : '내일'}] ${o.pickupInfo?.time || '시간미정'} 픽업: ${o.orderer?.name || '정보없음'}`);
        finalData.push(...upcomingDeliveries, ...upcomingPickups);
      }

      const noticeLines = events
        .filter(event => {
          if (event.type !== 'notice') return false;
          const today = startOfDay(new Date());
          const startDate = startOfDay(event.startDate);
          const endDate = event.endDate ? startOfDay(event.endDate) : startDate;
          const hasStarted = isEqual(today, startDate) || isAfter(today, startDate);
          const hasNotEnded = isEqual(today, endDate) || isBefore(today, endDate);

          // 공지 대상 필터링
          if (user?.role === '본사 관리자') {
            // 본사 관리자는 모든 공지를 볼 수 있음
            return hasStarted && hasNotEnded;
          } else {
            // 지점 사용자는 전체 공지와 자신의 지점 공지만 볼 수 있음
            return hasStarted && hasNotEnded &&
              (event.branchName === '전체' || event.branchName === user?.franchise);
          }
        })
        .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
        .slice(0, 10)
        .map(event => `📢 ${event.title}`);

      if (noticeLines.length === 0) {
        noticeLines.push("📢 오늘 등록된 공지사항이 없습니다.");
      }
      finalData.push(...noticeLines);

      setBoardData(finalData.filter(Boolean));
    };

    fetchData();
  }, [user, orders, events, weatherLine]); // Add weatherLine to dependency array

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
