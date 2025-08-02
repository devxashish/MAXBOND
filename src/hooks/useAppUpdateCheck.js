import { useEffect, useState } from 'react';

function useAppUpdateCheck(localVersion) {
  const [updateNeeded, setUpdateNeeded] = useState(false);

  useEffect(() => {
    async function checkVersion() {
      try {
        const response = await fetch('/version.json?_=' + Date.now(), {
          cache: 'no-store'   // Cache से fetch नहीं करेगा
        });
        const data = await response.json();
        console.log('Remote Version:', data.version, '| Local Version:', localVersion);

        if (data.version !== localVersion) {
          setUpdateNeeded(true);
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    }

    checkVersion();

  }, [localVersion]);

  return updateNeeded;
}

export default useAppUpdateCheck;
