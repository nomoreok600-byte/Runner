import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';

const TESTING = true; // set to false only right before publishing
const BREAK_AD = 'ca-app-pub-8535851607967164/9387316641';
const REWARD_AD = 'ca-app-pub-8535851607967164/4151301839';

export async function initAds() {
  try { await AdMob.initialize(); } catch (e) {}
}

export async function showBreakAd() {
  try {
    await AdMob.prepareInterstitial({ adId: BREAK_AD, isTesting: TESTING });
    await AdMob.showInterstitial();
  } catch (e) {}
}

export async function showRewardAd() {
  return new Promise(async (resolve) => {
    let rewarded = false;
    const sub = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; });
    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARD_AD, isTesting: TESTING });
      await AdMob.showRewardVideoAd();
    } catch (e) {}
    sub.remove();
    resolve(rewarded);
  });
}
