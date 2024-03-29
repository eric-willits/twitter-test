import './App.css';
import * as ethers from 'ethers';
import abiNFT from './abis/NFT.abi.json';
import { SettingsPanel } from './components/SettingsPanel';
import Tour from 'reactour';
//test test test

import { CustomToken as NFT } from './typechain/CustomToken';

import {
	BUILDING_COSTS,
	ENEMY_VALUES,
	INITIAL_GOLD
} from './components/TowerDefenseConstants';
import {
	IAnimation,
	IAvatarChatMessages,
	IBackgroundState,
	IBoardImage,
	IChatMessage,
	IChatRoom,
	IEmoji,
	IEmojiDict,
	IGifs,
	IMessageEvent,
	IPinnedItem,
	ITowerBuilding,
	ITowerDefenseState,
	ITowerUnit,
	IUserLocations,
	IUserProfile,
	IUserProfiles,
	IWeather,
	PanelItemEnum,
	PinTypes,
	IOrder,
	IMap,
	IWaterfallChat
} from './types';
import { ILineData, Whiteboard, drawLine } from './components/Whiteboard';
import { IconButton, Modal, Tooltip } from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import React, {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	Route,
	HashRouter as Router,
	Switch,
	useHistory,
	useParams
} from 'react-router-dom';
import { UserCursor, avatarMap } from './components/UserCursors';
import {
	activateFireworks,
	activateRandomConfetti,
	activateSchoolPride,
	activateSnow
} from './components/Animation';
import { cymbalHit, sounds } from './components/Sounds';

import io from 'socket.io-client';

import { Board } from './components/Board';
import { BottomPanel } from './components/BottomPanel';
import { ChevronRight } from '@material-ui/icons';
import { EnterRoomModal } from './components/RoomDirectoryPanel';
import { FirebaseContext } from './contexts/FirebaseContext';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { IMusicNoteProps } from './components/MusicNote';
import { NewChatroom } from './components/NewChatroom';
import { Panel } from './components/Panel';
import { TowerDefense } from './components/TowerDefense';
import _ from 'underscore';
import { backgrounds } from './components/BackgroundImages';
import update from 'immutability-helper';
import { v4 as uuidv4 } from 'uuid';
import { MetamaskSection } from './components/MetamaskSection';
import { AppStateContext } from './contexts/AppStateContext';
import { ErrorModal } from './components/ErrorModal';
import { SuccessModal } from './components/SuccessModal';
import { ISubmit } from './components/NFT/OrderInput';
import { AuthContext } from './contexts/AuthProvider';
import { config, network as configNetwork } from './config';
import { Marketplace } from './typechain/Marketplace';
import abiMarketplace from './abis/Marketplace.abi.json';
import { useHotkeys } from 'react-hotkeys-hook';
import { MapsContext } from './contexts/MapsContext';
import { Login } from './components/Login';

const clipboardy = require('clipboardy');

const API_KEY = 'A7O4CiyZj72oLKEX2WvgZjMRS7g4jqS4';
const GIF_FETCH = new GiphyFetch(API_KEY);
const GIF_PANEL_HEIGHT = 150;
const BOTTOM_PANEL_MARGIN_RATIO = 1.5;

const marketplaceSocket = io(config[configNetwork].marketplaceSocketURL, {
	transports: ['websocket']
});

function App() {
	const { socket } = useContext(AppStateContext);
	const {
		updateCoordinates,
		coordinates,
		markers,
		isMapShowing,
		zoom,
		updateZoom,
		updateIsMapShowing,
		updateMarkerText,
		addMarker,
		deleteMarker,
		resetMap
	} = useContext(MapsContext);
	const {
		network,
		isLoggedIn,
		accountId,
		provider,
		signIn
		// signIn,
		// balance
	} = useContext(AuthContext);
	//eslint-disable-next-line
	const [contractMarketplace, setContractMarketplace] = useState<Marketplace>();

	useEffect(() => {
		if (provider && isLoggedIn) {
			initMarketplaceContract(provider);
		}
	}, [provider, isLoggedIn]);

	const initMarketplaceContract = async (
		provider: ethers.providers.Web3Provider
	) => {
		try {
			const newContractMarketplace = new ethers.Contract(
				config[configNetwork].contractAddressMarketplace,
				abiMarketplace,
				provider.getSigner()
			) as Marketplace;

			setContractMarketplace(newContractMarketplace);
		} catch (e) {
			console.log(e);
		}
	};

	const [roomData, setRoomData] = useState<IChatRoom>();
	// todo allow buy, cancel order
	//eslint-disable-next-line
	const [contractsNFT, setContractsNFT] = useState<{
		[contractAddress: string]: NFT;
	}>({});

	const [hasFetchedRoomPinnedItems, setHasFetchedRoomPinnedItems] = useState(
		false
	);

	const { roomId } = useParams<{ roomId?: string }>();
	const history = useHistory();
	useEffect(() => {
		setUserProfile((profile) => ({...profile, currentRoom: roomId}));
		socket.emit('event', {
			key: 'currentRoom',
			value: roomId
		})
		return history.listen(() => {
			resetMap();
		});
	}, [history, resetMap, roomId, socket]);

	const [isInvalidRoom, setIsInvalidRoom] = useState<boolean | undefined>();
	const [invalidRoomMessage, setInvalidRoomMessage] = useState<string | undefined>();
	const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(
		null
	);
	const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(
		null
	);

	const firebaseContext = useContext(FirebaseContext);
	const [isPanelOpen, setIsPanelOpen] = useState(true);
	const [modalState, setModalState] = useState<
		'new-room' | 'enter-room' | 'error' | 'success' | null
	>(null);
	const [musicNotes, setMusicNotes] = useState<IMusicNoteProps[]>([]);
	const [emojis, setEmojis] = useState<IEmoji[]>([]);
	const [gifs, setGifs] = useState<IGifs[]>([]);
	const [NFTs, setNFTs] = useState<Array<IOrder & IPinnedItem>>([]);
	const [loadingNFT, setLoadingNFT] = useState<ISubmit>();
	const [pinnedText, setPinnedText] = useState<{ [key: string]: IPinnedItem }>(
		{}
	);
	const [movingBoardItem, setMovingBoardItem] = useState<
		| { type: PinTypes; itemKey: string; value?: any; isNew?: boolean }
		| undefined
	>();
	const [images, setImages] = useState<IBoardImage[]>([]);
	const [brushColor, setBrushColor] = useState('black');
	const [background, setBackground] = useState<IBackgroundState>({
		type: undefined
	});
	const [videoId, setVideoId] = useState<string>('');
	const [volume, setVolume] = useState<number>(0.4);

	const bottomPanelRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
	const [chatMessages, setChatMessages] = useState<IChatMessage[]>([]);
	const [avatarMessages, setAvatarMessages] = useState<IAvatarChatMessages>({});
	const [selectedPanelItem, setSelectedPanelItem] = useState<
		PanelItemEnum | undefined
	>(undefined);

	const [animations, setAnimations] = useState<IAnimation[]>([]);
	const [roomToEnter, setRoomToEnter] = useState<string>('');
	const audio = useRef<HTMLAudioElement>(new Audio(cymbalHit));
	const audioNotification = useRef<HTMLAudioElement>();

	const [
		towerDefenseState,
		setTowerDefenseState
	] = useState<ITowerDefenseState>({
		isPlaying: false,
		towers: [],
		units: [],
		projectiles: [],
		gold: 0
	});

	const [userLocations, setUserLocations] = useState<IUserLocations>({});
	const [userProfiles, setUserProfiles] = useState<IUserProfiles>({});
	const [userProfile, setUserProfile] = useState<IUserProfile>({
		name: '',
		avatar: '',
		weather: { temp: '', condition: '' },
		soundType: '',
		currentRoom: 'default',
		email: ''
	});
	const userCursorRef = React.createRef<HTMLDivElement>();

	const [weather, setWeather] = useState<IWeather>({
		temp: '',
		condition: ''
	});

	const [showTour, setShowTour] = useState(false);
	const [showLoginModal, setShowLoginModal] = useState(true);
	const [isFirstVisit, setIsFirstVisit] = useState(false);
	const [step, setStep] = useState(0);


	const [waterfallChat, setWaterfallChat] = useState<IWaterfallChat>({
		top: 400,
		left: 800,
		messages: [],
		show: true
	});

	useEffect(() => {
		setHasFetchedRoomPinnedItems(false);
	}, [roomId]);

	const playEmoji = useCallback((dict: IEmojiDict) => {
		const { x, y } = generateRandomXY();

		setEmojis((emojis) =>
			emojis.concat({ top: y, left: x, key: uuidv4(), dict })
		);
	}, []);

	useEffect(() => {
		if (modalErrorMessage) {
			setModalState('error');
		}
	}, [modalErrorMessage]);

	useEffect(() => {
		if (modalSuccessMessage) {
			setModalState('success');
		}
	}, [modalSuccessMessage]);

	const addNewContract = async (
		nftAddress: string
	): Promise<NFT | undefined> => {
		if (!provider) return undefined;

		const contractNFT = new ethers.Contract(
			nftAddress,
			abiNFT,
			provider.getSigner()
		) as NFT;

		setContractsNFT((contractsNFT) => ({
			...contractsNFT,
			[nftAddress]: contractNFT
		}));

		return contractNFT;
	};

	useEffect(() => {
		if (isLoggedIn && network && network !== configNetwork) {
			setModalErrorMessage(
				`Please connect metamask to the ${configNetwork} network`
			);
		}
	}, [network, isLoggedIn]);

	//FETCH USER DATA
	useEffect(() => {
		if(accountId && isLoggedIn){
			firebaseContext.getUser(accountId)
				.then((res: any) => {
					if(res.data.email){
						setShowLoginModal(false);
					}
					if(userProfile.email){
						setUserProfile((profile) => ({ ...profile, name: res.data.screenName, avatar: res.data.avatar }));
					} else {
						setUserProfile((profile) => ({ ...profile, name: res.data.screenName, avatar: res.data.avatar, email: res.data.email }));
					}
					socket.emit('event', {
						key: 'avatar',
						value: res.data.avatar
					});
					socket.emit('event', {
						key: 'username',
						value: res.data.screenName
					});
				})
				.catch((err: any) => {
					firebaseContext.createUser(accountId, userProfile.name, userProfile.avatar)
						.then(() => setIsFirstVisit(true))
						.catch(err => console.log(err));
					console.log(err)
				});
		}
	}, [accountId, isLoggedIn, userProfile.avatar, userProfile.name, userProfile.email, socket, firebaseContext])

	useEffect(() => {
		async function onAddOrder(order: IOrder) {
			if (order.ownerAddress.toLowerCase() === accountId?.toLowerCase()) {
				const { x, y } = generateRandomXY(true, true);
				const { x: relativeX, y: relativeY } = getRelativePos(x, y, 0, 0);
				const { isSuccessful, message } = await firebaseContext.pinRoomItem(
					roomId || 'default',
					{
						type: 'NFT',
						top: relativeY,
						left: relativeX,
						order
					}
				);

				if (isSuccessful) {
					setNFTs((nfts) =>
						nfts.concat({ ...order, top: y, left: x, type: 'NFT' })
					);

					socket.emit('event', {
						key: 'pin-item',
						type: 'NFT',
						top: y,
						left: x,
						itemKey: (order as IOrder & IPinnedItem).key!,
						isNew: true
					});
					setLoadingNFT(undefined);
				} else if (message) {
					setModalErrorMessage(message);
				}
			}
		}

		marketplaceSocket.on('add-order', onAddOrder);

		return () => {
			marketplaceSocket.off('add-order', onAddOrder);
		};
	}, [firebaseContext, accountId, roomId, socket]);

	const onNFTSuccess = (submission: ISubmit) => {
		setLoadingNFT(submission);
	};

	const deleteProfileSoundType = () =>
		setUserProfile((profile) => ({ ...profile, soundType: '' }));

	const playSound = useCallback((soundType) => {
		audio.current = new Audio(sounds[soundType]);

		if (!audio || !audio.current) return;

		const randomX = Math.random() * window.innerWidth;
		const randomY = Math.random() * window.innerHeight;

		setMusicNotes((notes) =>
			notes.concat({ top: randomY, left: randomX, key: uuidv4() })
		);

		audio.current.currentTime = 0;
		audio.current.play();
	}, []);

	const playPreviewSound = useCallback((soundType) => {
		audio.current = new Audio(sounds[soundType]);
		if (!audio || !audio.current) return;

		audio.current.currentTime = 0;
		audio.current.play();
	}, []);

	const onClickPanelItem = (key: string) => {
		switch (key) {
			case 'sound':
			case 'emoji':
			case 'chat':
			case 'gifs':
			case 'tower':
			case 'animation':
			case 'background':
			case 'whiteboard':
			case 'weather':
			case 'maps':
			case 'roomDirectory':
			case 'settings':
			case 'poem':
			case 'email':
			case 'browseNFT':
			case 'NFT':
			case 'youtube':
				setSelectedPanelItem(
					selectedPanelItem === key ? undefined : (key as PanelItemEnum)
				);
				break;
			case 'new-room':
				setModalState('new-room');
				setSelectedPanelItem(
					selectedPanelItem === key ? undefined : (key as PanelItemEnum)
				);
				break;
		}
	};

	const handleChatMessage = useCallback((message: IMessageEvent) => {
		const { userId, value } = message;
		setAvatarMessages((messages) => ({
			...messages,
			[userId]: (messages[userId] || []).concat(value)
		}));
	}, []);

	const onShowChat = () => {
		setWaterfallChat((waterfallChat) => ({ ...waterfallChat, show: !waterfallChat.show }));
	}
	const updateWaterfallChat = useCallback((message: IMessageEvent) => {
		const { avatar, value } = message;
		setWaterfallChat((waterfallChat) => ({ ...waterfallChat, messages: waterfallChat.messages.concat({ "avatar": avatar , "message": value}) }));
	}, []);

	const drawLineEvent = useCallback((strLineData) => {
		let lineData: ILineData = JSON.parse(strLineData);
		const { prevX, prevY, currentX, currentY, color } = lineData;
		drawLine(true, canvasRef, prevX, prevY, currentX, currentY, color, false);
	}, []);

	const addGif = useCallback((gifId: string, gifKey?: string) => {
		const { x, y } = generateRandomXY(true, true);
		GIF_FETCH.gif(gifId).then((data) => {
			const newGif: IGifs = {
				top: y,
				left: x,
				key: gifKey || uuidv4(),
				data: data.data
			};
			setGifs((gifs) => gifs.concat(newGif));
		});
	}, []);

	const addImage = useCallback((image: string, imageKey?: string) => {
		const { x, y } = generateRandomXY(true, true);
		const newImage: IBoardImage = {
			top: y,
			left: x,
			key: imageKey || uuidv4(),
			url: imageToUrl(image)
		};
		setImages((images) => images.concat(newImage));
	}, []);

	const updateCursorPosition = useMemo(
		() =>
			_.throttle((position: [number, number]) => {
				socket.emit('cursor move', { x: position[0], y: position[1] });
			}, 200),
		[socket]
	);

	const onMouseMove = useCallback(
		(event: MouseEvent) => {
			const x = event.clientX;
			const y = event.clientY;

			const width = window.innerWidth;
			const height = window.innerHeight;

			const relativeX = (x - 60) / width;
			const relativeY = (y - 60) / height;

			updateCursorPosition([relativeX, relativeY]);

			if (userCursorRef.current) {
				userCursorRef.current.style.left = x - 30 + 'px';
				userCursorRef.current.style.top = y - 30 + 'px';
			}
		},
		[updateCursorPosition, userCursorRef]
	);

	const playAnimation = useCallback((animationType: string) => {
		switch (animationType) {
			case 'confetti':
				activateRandomConfetti();
				break;
			case 'schoolPride':
				activateSchoolPride();
				break;
			case 'fireworks':
				activateFireworks();
				break;
			case 'snow':
				activateSnow();
				break;
		}
	}, []);

	const onIsTyping = (isTyping: boolean) => {
		socket.emit('event', {
			key: 'isTyping',
			value: isTyping
		});
	};

	useEffect(() => {
		if (bottomPanelRef.current) {
			setBottomPanelHeight(
				selectedPanelItem ? bottomPanelRef.current.offsetHeight : 0
			);
		}
		if(selectedPanelItem === "settings"){
			setStep(1);
		} else if (selectedPanelItem === "roomDirectory"){
			setStep(4);
		} else if (selectedPanelItem === "youtube"){
			setStep(5);
		}
	}, [selectedPanelItem]);

	useEffect(() => {
		window.addEventListener('mousemove', onMouseMove);
	}, [onMouseMove]);

	const onCursorMove = useCallback(
		function cursorMove(
			clientId: string,
			[x, y]: number[],
			clientProfile: IUserProfile
		) {
			const width = window.innerWidth;
			const height = window.innerHeight;

			const absoluteX = width * x;
			const absoluteY = height * y;
			setUserLocations((userLocations) => {
				const newUserLocations = {
					...userLocations,
					[clientId]: {
						...userLocations[clientId],
						x: absoluteX,
						y: absoluteY
					}
				};
				return newUserLocations;
			});

			setUserProfiles((userProfiles) => ({
				...userProfiles,
				[clientId]: {
					...userProfiles[clientId],
					...clientProfile,
					hideAvatar:
						absoluteY > height - BOTTOM_PANEL_MARGIN_RATIO * bottomPanelHeight
				}
			}));
		},
		[bottomPanelHeight]
	);

	const playTextAnimation = useCallback((animationType: string) => {
		if (animationType === 'start game') {
			setAnimations((animations) => animations.concat({ type: 'start game' }));
			setTimeout(() => {
				setAnimations((animations) => animations.concat({ type: 'info' }));
			}, 2000);
		}
		if (animationType === 'end game') {
			setAnimations((animations) => animations.concat({ type: 'end game' }));
		}
	}, []);

	const fireTowers = useCallback(
		(towerTypes: string[]) => {
			towerDefenseState.towers.forEach((tower) => {
				if (towerTypes.includes(tower.type)) {
					// only hit first enemy
					for (let i = 0; i < towerDefenseState.units.length; i++) {
						const unit = towerDefenseState.units[i];

						const { ref } = unit;
						if (ref && ref.current) {
							const rect = ref.current.getBoundingClientRect();

							const distance = getDistanceBetweenPoints(
								tower.left,
								tower.top,
								rect.left,
								rect.top
							);

							const relativeDistance = distance / window.innerWidth;

							if (relativeDistance < 0.4) {
								socket.emit('event', {
									key: 'tower defense',
									value: 'fire tower',
									towerKey: tower.key,
									unitKey: unit.key
								});
								break;
							}
						}
					}
				}
			});
		},
		[towerDefenseState, socket]
	);

	const handleTowerDefenseEvents = useCallback(
		(message: IMessageEvent) => {
			if (message.value === 'start') {
				playTextAnimation('start game');
				setTowerDefenseState((state) => ({
					...state,
					isPlaying: true,
					gold: INITIAL_GOLD
				}));
			}
			if (message.value === 'end') {
				playTextAnimation('end game');
				setTowerDefenseState((state) => ({
					...state,
					isPlaying: false,
					towers: [],
					units: [],
					projectiles: [],
					selectedPlacementTower: undefined
				}));
			}
			if (message.value === 'spawn enemy') {
				const enemy = message.enemy as ITowerUnit;

				enemy.top = window.innerHeight / 2;
				enemy.left = 0;
				enemy.ref = React.createRef();
				enemy.value = ENEMY_VALUES[enemy.type];

				setTowerDefenseState((state) => ({
					...state,
					units: state.units.concat(enemy)
				}));
			}

			if (message.value === 'add tower') {
				const { x, y, type, towerKey } = message;
				setTowerDefenseState((state) => ({
					...state,
					towers: state.towers.concat({
						key: towerKey,
						type: type,
						cost: BUILDING_COSTS[type],
						top: y * window.innerHeight,
						left: x * window.innerWidth
					})
				}));
			}

			if (message.value === 'fire towers') {
				fireTowers(message.towerTypes);
			}

			if (message.value === 'hit unit') {
				const { towerKey, unitKey } = message;

				setTowerDefenseState((state) => {
					let startPos = { x: 0, y: 0 };
					let endPos = { x: 0, y: 0 };

					const tower = state.towers.find((tower) => tower.key === towerKey);
					const unit = state.units.find((unit) => unit.key === unitKey);

					if (tower && unit) {
						startPos.x = tower.left;
						startPos.y = tower.top;

						const unitRect = unit.ref.current?.getBoundingClientRect();
						if (unitRect) {
							endPos.x = unitRect.left + 30;
							endPos.y = unitRect.top;
						}
					}

					return {
						...state,
						projectiles: state.projectiles.concat({
							towerKey,
							unitKey,
							key: uuidv4(),
							startPos,
							endPos
						})
					};
				});
			}

			if (message.value === 'towers') {
				const { towers } = message;
				setTowerDefenseState((state) => ({
					...state,
					towers: towers.map((tower: ITowerBuilding) => ({
						...tower,
						top: tower.top * window.innerHeight,
						left: tower.left * window.innerWidth
					}))
				}));
			}
		},
		[fireTowers, playTextAnimation]
	);

	const handlePinItemMessage = useCallback(
		(message: IMessageEvent, isUnpin?: boolean) => {
			const { type, itemKey } = message;
			switch (type) {
				case 'gif':
					const gifIndex = gifs.findIndex((gif) => gif.key === itemKey);
					const gif = gifs[gifIndex];
					if (gif) {
						if (isUnpin) {
							setGifs([
								...gifs.slice(0, gifIndex),
								...gifs.slice(gifIndex + 1)
							]);
						} else {
							setGifs([
								...gifs.slice(0, gifIndex),
								{ ...gif, isPinned: true },
								...gifs.slice(gifIndex + 1)
							]);
						}
					}
					break;

				case 'image':
					const index = images.findIndex((image) => image.key === itemKey);
					const image = images[index];
					if (image) {
						if (isUnpin) {
							setImages([
								...images.slice(0, index),
								...images.slice(index + 1)
							]);
						} else {
							setImages([
								...images.slice(0, index),
								{ ...image, isPinned: true },
								...images.slice(index + 1)
							]);
						}
					}
					break;
				case 'background':
					if (isUnpin) {
						setBackground({
							name: '',
							isPinned: false,
							type: undefined,
							mapData: undefined
						});
					} else {
						console.log(message);
						setBackground({
							name: message.name,
							isPinned: true,
							type: message.subType,
							mapData: message.mapData
						});
					}
					break;
				case 'text':
					if (isUnpin) {
						const newPinnedText = { ...pinnedText };
						delete newPinnedText[itemKey];
						setPinnedText(newPinnedText);
					} else {
						setPinnedText((pinnedText) => ({
							...pinnedText,
							[message.itemKey]: {
								type: 'text',
								text: message.value,
								key: message.itemKey,
								top: message.top * window.innerHeight,
								left: message.left * window.innerWidth,
								isPinned: true
							}
						}));
					}
					break;
				case 'NFT':
					const nftIndex = NFTs.findIndex((nft) => nft.key === itemKey);
					const nft = NFTs[nftIndex];
					if (nft) {
						if (isUnpin) {
							setNFTs([
								...NFTs.slice(0, nftIndex),
								...NFTs.slice(nftIndex + 1)
							]);
						} else {
							setNFTs([
								...NFTs.slice(0, nftIndex),
								{ ...nft, isPinned: true },
								...NFTs.slice(nftIndex + 1)
							]);
						}
					}
					break;
			}
		},
		[gifs, images, pinnedText, NFTs]
	);

	const handleMoveItemMessage = useCallback(
		(message: IMessageEvent) => {
			const { type, top, left, itemKey } = message;
			const relativeTop = top * window.innerHeight;
			const relativeLeft = left * window.innerWidth;

			switch (type) {
				case 'image':
					const imageIndex = images.findIndex((image) => image.key === itemKey);
					const image = images[imageIndex];
					if (image) {
						setImages([
							...images.slice(0, imageIndex),
							{
								...image,
								top: relativeTop,
								left: relativeLeft
							},
							...images.slice(imageIndex + 1)
						]);
					}
					break;

				case 'gif':
					const gifIndex = gifs.findIndex((gif) => gif.key === itemKey);
					const gif = gifs[gifIndex];
					if (gif) {
						setGifs([
							...gifs.slice(0, gifIndex),
							{
								...gif,
								top: relativeTop,
								left: relativeLeft
							},
							...gifs.slice(gifIndex + 1)
						]);
					}
					break;

				case 'text':
					const newPinnedText = { ...pinnedText };
					if (newPinnedText[itemKey]) {
						setPinnedText((pinnedText) => ({
							...pinnedText,
							[itemKey]: {
								...pinnedText[itemKey],
								top: relativeTop,
								left: relativeLeft
							}
						}));
					}
					break;
				case 'NFT':
					const nftIndex = NFTs.findIndex((nft) => nft.key === itemKey);
					const nft = NFTs[nftIndex];
					if (nft) {
						setNFTs([
							...NFTs.slice(0, nftIndex),
							{
								...nft,
								top: relativeTop,
								left: relativeLeft
							},
							...NFTs.slice(nftIndex + 1)
						]);
					}
					break;
				case 'chat':
					setWaterfallChat((waterfallChat) => ({ ...waterfallChat, top: relativeTop, left: relativeLeft}));
					break;
			}
		},
		[images, NFTs, gifs, pinnedText]
	);

	// const onBuy = async (orderId: string) => {
	// 	if (!accountId) await signIn();

	// 	if (!provider || !contractMarketplace)
	// 		return console.log(
	// 			'no provider or contract marketplace: ',
	// 			provider,
	// 			contractMarketplace
	// 		);

	// 	const orderIndex = NFTs.findIndex((nft) => nft.key === orderId);

	// 	if (orderIndex === -1) return console.log('no order for id ', orderId);

	// 	const order = NFTs[orderIndex];

	// 	const { tokenId, priceEth, contractAddress, isPartnered } = order;

	// 	if (balance && parseFloat(balance) < parseFloat(priceEth))
	// 		return alert('balance too low');

	// 	let contractNFT = contractsNFT[contractAddress];

	// 	if (!contractNFT) {
	// 		const contractResult = await addNewContract(contractAddress);

	// 		if (!contractResult) return;

	// 		contractNFT = contractResult;
	// 	}

	// 	try {
	// 		const buyOrder = isPartnered
	// 			? await contractMarketplace.buyOrderPartnered(
	// 					contractAddress,
	// 					tokenId,
	// 					config.userAddresses.adventureNetworks,
	// 					{
	// 						value: ethers.utils.parseEther(priceEth)
	// 					}
	// 			  )
	// 			: await contractMarketplace.buyOrder(contractAddress, tokenId, {
	// 					value: ethers.utils.parseEther(priceEth)
	// 			  });

	// 		buyOrder.wait().then(() => {
	// 			// const newNFTs = { ...NFTs };
	// 			// delete newNFTs[];
	// 			// setOrders(newOrders);
	// 			// getSetBalance(provider);
	// 			setNFTs([...NFTs.slice(0, orderIndex), ...NFTs.slice(orderIndex + 1)]);
	// 			alert(
	// 				'successfully bought NFT, it has been transferred to your account'
	// 			);
	// 		});
	// 	} catch (e) {
	// 		if (e && e.data && e.data.message) {
	// 			const indexOfRevert = e.data.message.indexOf('revert');
	// 			if (indexOfRevert !== -1) {
	// 				alert(
	// 					'error buying order: ' +
	// 						e.data.message.substring(indexOfRevert + 'revert'.length)
	// 				);
	// 			}
	// 		} else {
	// 			alert('error buying order');
	// 		}
	// 	}
	// };

	// const onCancel = async (orderId: string) => {
	// 	if (!isLoggedIn) await signIn();

	// 	if (!provider || !contractMarketplace)
	// 		return console.log(
	// 			'no provider or contract marketplace: ',
	// 			provider,
	// 			contractMarketplace
	// 		);

	// 	const orderIndex = NFTs.findIndex((nft) => nft.key === orderId);

	// 	if (orderIndex === -1) return console.log('no order for id ', orderId);

	// 	const order = NFTs[orderIndex];

	// 	console.log('oncancel order = ', order);

	// 	const { tokenId, contractAddress } = order;

	// 	let contractNFT = contractsNFT[contractAddress];

	// 	if (!contractNFT) {
	// 		const contractResult = await addNewContract(contractAddress);

	// 		if (!contractResult) return;

	// 		contractNFT = contractResult;
	// 	}

	// 	console.log('going to cancel order');
	// 	try {
	// 		const cancelOrder = await contractMarketplace.cancelOrder(
	// 			contractAddress,
	// 			tokenId,
	// 			{
	// 				gasLimit: 100000
	// 			}
	// 		);

	// 		cancelOrder.wait().then(() => {
	// 			// const newOrders = { ...orders };
	// 			// delete newOrders[order.id];
	// 			// setOrders(newOrders);
	// 			// getSetBalance(provider);

	// 			setNFTs([...NFTs.slice(0, orderIndex), ...NFTs.slice(orderIndex + 1)]);
	// 			alert('successfully canceled order');
	// 		});
	// 	} catch (e) {
	// 		if (e && e.data && e.data.message) {
	// 			const indexOfRevert = e.data.message.indexOf('revert');
	// 			if (indexOfRevert !== -1) {
	// 				alert(
	// 					'error canceling order: ' +
	// 						e.data.message.substring(indexOfRevert + 'revert'.length)
	// 				);
	// 			}
	// 		} else {
	// 			alert('error canceling order');
	// 		}
	// 	}
	// };

	useEffect(() => {
		const onMessageEvent = (message: IMessageEvent) => {
			switch (message.key) {
				case 'map':
					if (message.isMapShowing !== undefined) {
						updateIsMapShowing(message.isMapShowing);
					}
					if (message.zoom !== undefined) {
						updateZoom(message.zoom);
					}
					if (message.coordinates) {
						const newCoordinates = {
							lat: message.coordinates.lat,
							lng: message.coordinates.lng
						};
						updateCoordinates(newCoordinates);
					}
					if (message.func === 'add') {
						addMarker(message.marker);
					}
					if (message.func === 'delete') {
						deleteMarker(message.index);
					}
					if (message.func === 'update') {
						updateMarkerText(message.index, message.text);
					}
					break;
				case 'sound':
					if (message.value) {
						playSound(message.value);
						setUserProfiles((profiles) => ({
							...profiles,
							[message.userId]: {
								...profiles[message.userId],
								soundType: message.value
							}
						}));
					}
					break;
				case 'youtube':
					// console.log('youtube socket');
					// console.log(message.value);
					setBackground({ name: '', isPinned: false });
					setVideoId(message.value);
					break;
				case 'emoji':
					if (message.value) {
						playEmoji(message.value);
					}
					break;
				case 'chat':
					if (message.value) {
						handleChatMessage(message);
						updateWaterfallChat(message);
					}
					break;
				case 'gif':
					if (message.value) {
						addGif(message.value, message.gifKey);
					}
					break;
				case 'image':
					if (message.value) {
						addImage(message.value, message.imageKey);
					}
					break;
				case 'tower defense':
					handleTowerDefenseEvents(message);
					break;
				case 'background':
					setVideoId('');
					setBackground((background) => ({
						...background,
						name: message.value,
						isPinned: message.isPinned,
						type: message.type,
						mapData: message.mapData
					}));
					break;
				case 'messages':
					setAvatarMessages(message.value as IAvatarChatMessages);
					break;
				case 'whiteboard':
					if (message.value) {
						drawLineEvent(message.value);
					}
					break;

				case 'animation':
					if (message.value) {
						playAnimation(message.value);
					}
					break;
				case 'isTyping':
					setUserProfiles((profiles) => ({
						...profiles,
						[message.id]: { ...profiles[message.id], isTyping: message.value }
					}));
					break;
				case 'username':
					setUserProfiles((profiles) => ({
						...profiles,
						[message.id]: { ...profiles[message.id], name: message.value }
					}));
					break;
				case 'avatar':
					setUserProfiles((profiles) => ({
						...profiles,
						[message.id]: { ...profiles[message.id], avatar: message.value }
					}));
					break;
				case 'currentRoom':
					setUserProfiles((profiles) => ({
						...profiles,
						[message.id]: { ...profiles[message.id], currentRoom: message.value }
					}));
				break;
				case 'weather':
					if (message.toSelf) {
						setUserProfile((profile) => ({
							...profile,
							weather: message.value
						}));
					} else {
						setUserProfiles((profiles) => ({
							...profiles,
							[message.id]: { ...profiles[message.id], weather: message.value }
						}));
					}

					break;
				case 'settings-url':
					if (message.value && message.isSelf) {
						setUserProfile((profile) => ({
							...profile,
							musicMetadata: message.value
						}));
					} else {
						setUserProfiles((profiles) => ({
							...profiles,
							[message.id]: {
								...profiles[message.id],
								musicMetadata: message.value
							}
						}));
					}
					break;
				case 'pin-item':
					handlePinItemMessage(message);
					break;
				case 'unpin-item':
					handlePinItemMessage(message, true);
					break;
				case 'move-item':
					handleMoveItemMessage(message);
					break;
			}
		};

		const onProfileInfo = (clientProfile: { name: string; avatar: string }) => {
			setUserProfile((profile) => ({ ...profile, ...clientProfile }));
		};

		const onRoomateDisconnect = (clientId: string) => {
			setUserLocations((userLocations) => {
				const newUserLocations = {
					...userLocations
				};

				delete newUserLocations[clientId];

				return newUserLocations;
			});
		};

		const onConnect = () => {
			if (roomId) {
				socket.emit('connect room', roomId);
			} else {
				socket.emit('connect room', 'default');
			}
		};

		socket.on('roommate disconnect', onRoomateDisconnect);
		socket.on('profile info', onProfileInfo);
		socket.on('cursor move', onCursorMove);
		socket.on('event', onMessageEvent);
		socket.on('connect', onConnect);

		return () => {
			socket.off('roomate disconnect', onRoomateDisconnect);
			socket.off('profile info', onProfileInfo);
			socket.off('cursor move', onCursorMove);
			socket.off('event', onMessageEvent);
			socket.off('connect', onConnect);
		};
	}, [
		handleTowerDefenseEvents,
		playEmoji,
		playSound,
		handleChatMessage,
		addGif,
		drawLineEvent,
		onCursorMove,
		audioNotification,
		playAnimation,
		roomId,
		handlePinItemMessage,
		handleMoveItemMessage,
		addImage,
		socket,
		updateIsMapShowing,
		updateZoom,
		updateCoordinates,
		addMarker,
		deleteMarker,
		updateMarkerText,
		updateWaterfallChat
	]);

	const actionHandler = (key: string, ...args: any[]) => {
		switch (key) {
			case 'chat':
				const chatValue = args[0] as string;
				if(chatValue === ''){
					return;
				}
				socket.emit('event', {
					key: 'chat',
					value: chatValue,
					avatar: userProfile.avatar
				});
				setUserProfile((profile) => ({ ...profile, message: chatValue }));
				setWaterfallChat((waterfallChat) => ({ ...waterfallChat, messages: waterfallChat.messages.concat( { "avatar": userProfile.avatar , "message": chatValue}) }));
				break;
			case 'chat-pin':
				const chatPinValue = args[0] as string;

				if (chatPinValue) {
					setMovingBoardItem({
						type: 'text',
						itemKey: uuidv4(),
						value: chatPinValue,
						isNew: true
					});
				}

				break;
			case 'emoji':
				const emoji = args[0] as IEmojiDict;
				playEmoji(emoji);
				socket.emit('event', {
					key: 'emoji',
					value: emoji
				});
				break;
			case 'sound':
				const soundType = args[0] as string;

				playSound(soundType);
				setUserProfile((profile) => ({ ...profile, soundType: soundType }));

				socket.emit('event', {
					key: 'sound',
					value: soundType
				});
				break;
			case 'previewSound':
				const previewedSoundType = args[0] as string;
				playPreviewSound(previewedSoundType);
				break;
			case 'gif':
				const gif = args[0] as string;
				socket.emit('event', {
					key: 'gif',
					value: gif
				});
				break;

			case 'tower defense':
				const { value, tower } = args[0] as {
					key: string;
					value: string;
					tower?: string;
				};
				if (value === 'select tower' && tower) {
					const towerObj: ITowerBuilding = {
						key: tower,
						type: tower,
						cost: BUILDING_COSTS[tower],
						top: 0,
						left: 0
					};

					setTowerDefenseState((state) => {
						if (state.selectedPlacementTower) {
							return {
								...state,
								selectedPlacementTower: undefined
							};
						}
						return {
							...state,
							selectedPlacementTower: towerObj
						};
					});
				} else {
					socket.emit('event', args[0]);
				}

				break;
			case 'background':
				const backgroundName = args[0] as string;
				socket.emit('event', {
					key: 'background',
					value: backgroundName
				});
				firebaseContext.unpinRoomItem(roomId || 'default', 'background');
				break;
			case 'image':
				const image = args[0] as string;
				socket.emit('event', {
					key: 'image',
					value: image
				});
				break;
			case 'animation':
				const animationType = args[0] as string;
				playAnimation(animationType);
				socket.emit('event', {
					key: 'animation',
					value: animationType
				});
				break;
			case 'whiteboard':
				const strlineData = args[0] as string;
				socket.emit('event', {
					key: 'whiteboard',
					value: strlineData
				});
				break;

			case 'settings':
				const type = args[0] as string;
				const settingsValue = args[1] as string;

				if (type === 'url') {
					socket.emit('event', {
						key: 'settings-url',
						value: settingsValue
					});
				} else if (type === 'name') {
					socket.emit('event', {
						key: 'username',
						value: settingsValue
					});
					if(accountId){
						firebaseContext.updateScreenname(accountId, settingsValue)
						.then(res => setUserProfile((profile) => ({ ...profile, name: settingsValue })))
						.catch(err => console.log(err));
					}
				} else if (type === 'avatar') {
					socket.emit('event', {
						key: 'avatar',
						value: settingsValue
					});
					if(accountId){
						firebaseContext.updateAvatar(accountId, settingsValue)
						.then(res => setUserProfile((profile) => ({ ...profile, avatar: settingsValue })))
						.catch(err => console.log(err));
					}
				} else if (type === "email") {
					setUserProfile((profile) => ({ ...profile, email: settingsValue }))
				}
				break;
			case 'weather':
				const location = args[0] as string;

				socket.emit('event', {
					key: 'weather',
					value: location
				});
				break;
			case 'roomDirectory':
				const roomName = args[0] as string;
				setRoomToEnter(roomName);
				setModalState('enter-room');
				break;
			case 'new-room':
				setModalState('new-room');
				break;
			case 'send-email':
				socket.emit('event', {
					key: 'send-email',
					to: args[0],
					message: args[1],
					url: window.location.href
				});
				break;
			case 'youtube':
				const videoId = args[0] as string;
				socket.emit('event', {
					key: 'youtube',
					value: videoId
				});
				break;
			default:
				break;
		}
	};

	useHotkeys('ctrl+v', () => {
		if (clipboardy.read()) {
			clipboardy.read().then((value: string) =>
				setMovingBoardItem({
					type: 'text',
					itemKey: uuidv4(),
					value: value,
					isNew: true
				})
			);
		}
	});

	const onClickApp = useCallback(
		async (event: React.MouseEvent) => {
			setTowerDefenseState((state) => {
				const { x, y } = getRelativePos(event.clientX, event.clientY, 60, 60);
				if (state.selectedPlacementTower) {
					const newGold =
						state.gold - BUILDING_COSTS[state.selectedPlacementTower.type];
					if (newGold >= 0) {
						socket.emit('event', {
							key: 'tower defense',
							value: 'add tower',
							type: state.selectedPlacementTower.type,
							x,
							y
						});
						return {
							...state,
							gold: newGold,
							selectedPlacementTower: undefined
						};
					} else {
						setChatMessages((messages) =>
							messages.concat({
								top: y * window.innerHeight,
								left: x * window.innerWidth,
								key: uuidv4(),
								value: 'Not Enough Gold',
								isCentered: false
							})
						);
					}
					return { ...state, selectedPlacementTower: undefined };
				}
				return state;
			});

			if (movingBoardItem) {
				const { x, y } = getRelativePos(event.clientX, event.clientY, 90, 0);
				if (movingBoardItem.isNew && movingBoardItem.type === 'text') {
					const { itemKey, value } = movingBoardItem;

					const pinResult = await firebaseContext.pinRoomItem(
						roomId || 'default',
						{
							type: 'text',
							top: y,
							left: x,
							key: itemKey,
							value
						}
					);

					if (pinResult.isSuccessful) {
						socket.emit('event', {
							key: 'pin-item',
							type: movingBoardItem.type,
							value,
							top: y,
							left: x,
							itemKey,
							isNew: true
						});
					} else if (pinResult.message) {
						setModalErrorMessage(pinResult.message);
					}
				}

				setMovingBoardItem(undefined);
			}
		},
		[movingBoardItem, firebaseContext, roomId, socket]
	);

	const onWhiteboardPanel = selectedPanelItem === PanelItemEnum.whiteboard;

	const onCreateRoom = async (roomName: string, isAccessLocked: boolean, contractAddress?: string) => {
		const result = await firebaseContext.createRoom(roomName, isAccessLocked, contractAddress);
		if (result.isSuccessful) {
			setModalState(null);
			history.push(`/room/${roomName}`);
		}
		return result;
	};

	const onBrowseNFTPanel = selectedPanelItem === PanelItemEnum.browseNFT;

	useEffect(() => {
		const room = roomId || 'default';

		// if (isInvalidRoom === undefined) {
		firebaseContext.getRoom(room).then((result) => {
			if (result.isSuccessful) {
				setIsInvalidRoom(false);
				setRoomData(result.data);
			} else {
				setIsInvalidRoom(true);
				if (result.message) {
					//setModalErrorMessage(result.message);
					setInvalidRoomMessage(result.message);
				}
			}
			// if (result.data === null) {
			// 	setIsInvalidRoom(true);
			// } else {
			// 	setIsInvalidRoom(false);
			// }
		});
		// }

		if (!hasFetchedRoomPinnedItems) {
			setHasFetchedRoomPinnedItems(true);

			firebaseContext.getRoomPinnedItems(room).then((pinnedItems) => {
				if (!pinnedItems.data) return;

				const pinnedGifs: IGifs[] = [];
				const pinnedImages: IBoardImage[] = [];
				const pinnedText: { [key: string]: IPinnedItem } = {};
				const pinnedNFTs: Array<IOrder & IPinnedItem> = [];

				let backgroundType: 'image' | 'map' | undefined;
				let backgroundImg: string | undefined;
				let backgroundMap: IMap | undefined;

				pinnedItems.data.forEach((item) => {
					if (item.type === 'gif') {
						pinnedGifs.push({
							...item,
							top: item.top! * window.innerHeight,
							left: item.left! * window.innerWidth,
							isPinned: true,
							key: item.key!,
							data: item.data!
						});
					} else if (item.type === 'image') {
						pinnedImages.push({
							...item,
							top: item.top! * window.innerHeight,
							left: item.left! * window.innerWidth,
							isPinned: true,
							key: item.key!,
							url: item.url
						});
					} else if (item.type === 'background') {
						backgroundType = item.subType;
						backgroundImg = item.name;
						backgroundMap = item.mapData;
					} else if (item.type === 'text') {
						pinnedText[item.key!] = {
							...item,
							top: item.top! * window.innerHeight,
							left: item.left! * window.innerWidth,
							isPinned: true,
							key: item.key!,
							text: item.value
						};
					} else if (item.type === 'NFT') {
						if (item.order && item.order.id) {
							pinnedNFTs.push({
								...(item as IPinnedItem & IOrder),
								top: item.top! * window.innerHeight,
								left: item.left! * window.innerWidth,
								isPinned: true,
								key: item.order.id,
								text: item.value
							});
						}
					}
				});

				setGifs(pinnedGifs);
				setImages(pinnedImages);
				setPinnedText(pinnedText);
				setBackground({
					name: backgroundImg,
					isPinned: !!backgroundImg || !!backgroundMap,
					mapData: backgroundMap,
					type: backgroundType
				});
				setNFTs(pinnedNFTs);
			});
		}
	}, [
		hasFetchedRoomPinnedItems,
		// isInvalidRoom,
		roomId,
		// firebaseContext.getRoomPinnedItems,
		// firebaseContext.getRoom,
		firebaseContext
	]);

	const pinGif = async (gifKey: string) => {
		const gifIndex = gifs.findIndex((gif) => gif.key === gifKey);
		const gif = gifs[gifIndex];
		const room = roomId || 'default';

		if (gif && !gif.isPinned) {
			const result = await firebaseContext.pinRoomItem(room, {
				...gif,
				type: 'gif',
				left: gif.left / window.innerWidth,
				top: gif.top / window.innerHeight
			});

			if (result.isSuccessful) {
				setGifs([
					...gifs.slice(0, gifIndex),
					{ ...gif, isPinned: true },
					...gifs.slice(gifIndex + 1)
				]);

				socket.emit('event', {
					key: 'pin-item',
					type: 'gif',
					itemKey: gifKey
				});
			} else if (result.message) {
				setModalErrorMessage(result.message);
			}
		}
	};

	const pinNFT = async (nftId: string) => {
		const nftIndex = NFTs.findIndex((nft) => nft.key === nftId);
		const nft = NFTs[nftIndex];
		const room = roomId || 'default';

		if (nft && !nft.isPinned) {
			const result = await firebaseContext.pinRoomItem(room, {
				...nft,
				type: 'NFT',
				left: nft.left / window.innerWidth,
				top: nft.top / window.innerHeight
			});

			if (result.isSuccessful) {
				setNFTs([
					...NFTs.slice(0, nftIndex),
					{ ...nft, isPinned: true },
					...NFTs.slice(nftIndex + 1)
				]);

				socket.emit('event', {
					key: 'pin-item',
					type: 'NFT',
					itemKey: nftId
				});
			} else if (result.message) {
				setModalErrorMessage(result.message);
			}
		}
	};

	const pinImage = async (imageKey: string) => {
		const imageIndex = images.findIndex((image) => image.key === imageKey);
		const image = images[imageIndex];
		const room = roomId || 'default';

		if (image && !image.isPinned) {
			const result = await firebaseContext.pinRoomItem(room, {
				...image,
				type: 'image',
				left: image.left / window.innerWidth,
				top: image.top / window.innerHeight
			});

			if (result.isSuccessful) {
				setImages([
					...images.slice(0, imageIndex),
					{ ...image, isPinned: true },
					...images.slice(imageIndex + 1)
				]);

				socket.emit('event', {
					key: 'pin-item',
					type: 'image',
					itemKey: imageKey
				});
			} else if (result.message) {
				setModalErrorMessage(result.message);
			}
		}
	};

	const pinBackground = async () => {
		/* if(background.isPinned===true){
			unpinBackground();
		} */
		const room = roomId || 'default';

		let backgroundType: 'image' | 'map' | undefined;
		if (isMapShowing) {
			backgroundType = 'map';
		} else if (background.name) {
			backgroundType = 'image';
		}

		let backgroundName: string | undefined;
		if (backgroundType === 'image') {
			backgroundName = background.name;
		} else {
			backgroundName = '';
		}

		let mapCoordinates: IMap | undefined = { coordinates, markers, zoom };
		if (backgroundType !== 'map') {
			mapCoordinates = undefined;
		}

		const result = await firebaseContext.pinRoomItem(room, {
			name: backgroundName,
			type: 'background',
			top: 0,
			left: 0,
			subType: backgroundType,
			mapData: mapCoordinates
		});

		if (result.isSuccessful) {
			setBackground((background) => ({
				name: backgroundName,
				isPinned: true,
				type: backgroundType,
				mapData: mapCoordinates
			}));

			socket.emit('event', {
				key: 'pin-item',
				type: 'background',
				name: backgroundName,
				subType: backgroundType,
				mapData: mapCoordinates
			});
			updateIsMapShowing(false);
			socket.emit('event', {
				key: 'map',
				isMapShowing: false
			});
		} else if (result.message) {
			setModalErrorMessage(result.message);
		}
		// }
	};

	const unpinBackground = async () => {
		const room = roomId || 'default';

		if (background.isPinned) {
			const { isSuccessful, message } = await firebaseContext.unpinRoomItem(
				room,
				'background'
			);

			if (isSuccessful) {
				let oldBackgroundType = "";
				if(background.type){
					oldBackgroundType = background.type.valueOf();
				}

				setBackground({
					name: '',
					isPinned: false,
					type: undefined,
					mapData: undefined
				});
				socket.emit('event', {
					key: 'unpin-item',
					type: 'background'
				});

				if(oldBackgroundType === "map"){
					updateIsMapShowing(true);
					socket.emit('event', {
						key: 'map',
						isMapShowing: true
					});
				}
			} else if (message) {
				setModalErrorMessage(message);
			}
		}
	};

	const unpinGif = async (gifKey: string) => {
		const gifIndex = gifs.findIndex((gif) => gif.key === gifKey);
		const gif = gifs[gifIndex];
		const room = roomId || 'default';

		if (gif && gif.isPinned) {
			const { isSuccessful, message } = await firebaseContext.unpinRoomItem(
				room,
				gif.key
			);
			if (isSuccessful) {
				setGifs([...gifs.slice(0, gifIndex), ...gifs.slice(gifIndex + 1)]);

				socket.emit('event', {
					key: 'unpin-item',
					type: 'gif',
					itemKey: gifKey
				});
			} else if (message) {
				setModalErrorMessage(message);
			}
		}
	};

	const unpinNFT = async (nftId: string) => {
		const index = NFTs.findIndex((nft) => nft.key === nftId);
		const nft = NFTs[index];
		const room = roomId || 'default';

		if (nft && nft.isPinned) {
			const { isSuccessful, message } = await firebaseContext.unpinRoomItem(
				room,
				nft.key!
			);

			if (isSuccessful) {
				setNFTs([...NFTs.slice(0, index), ...NFTs.slice(index + 1)]);

				socket.emit('event', {
					key: 'unpin-item',
					type: 'NFT',
					itemKey: nftId
				});
			} else if (message) {
				setModalErrorMessage(message);
			}
		}
	};

	const unpinImage = async (imageKey: string) => {
		const index = images.findIndex((image) => image.key === imageKey);
		const image = images[index];
		const room = roomId || 'default';

		if (image && image.isPinned) {
			const { isSuccessful, message } = await firebaseContext.unpinRoomItem(
				room,
				image.key
			);
			if (isSuccessful) {
				setImages([...images.slice(0, index), ...images.slice(index + 1)]);

				socket.emit('event', {
					key: 'unpin-item',
					type: 'image',
					itemKey: imageKey
				});
			} else if (message) {
				setModalErrorMessage(message);
			}
		}
	};

	const unpinText = async (key: string) => {
		const { isSuccessful, message } = await firebaseContext.unpinRoomItem(
			roomId || 'default',
			key
		);

		if (isSuccessful) {
			const newPinnedText = { ...pinnedText };

			delete newPinnedText[key];

			setPinnedText(newPinnedText);

			socket.emit('event', {
				key: 'unpin-item',
				type: 'text',
				itemKey: key
			});
		} else if (message) {
			setModalErrorMessage(message);
		}
	};

	const moveItem = async (
		type: PinTypes,
		id: string,
		left: number,
		top: number,
		deltaX: number,
		deltaY: number
	) => {
		const { x, y } = getRelativePos(left, top, 0, 0);

		if (type === 'text') {
			setPinnedText(
				update(pinnedText, {
					[id]: {
						$merge: { left, top }
					}
				})
			);
		} else if (type === 'gif') {
			const gifIndex = gifs.findIndex((gif) => gif.key === id);
			if (gifIndex !== -1) {
				setGifs([
					...gifs.slice(0, gifIndex),
					{
						...gifs[gifIndex],
						top,
						left
					},
					...gifs.slice(gifIndex + 1)
				]);
			}
		} else if (type === 'image') {
			const imageIndex = images.findIndex((image) => image.key === id);
			if (imageIndex !== -1) {
				setImages([
					...images.slice(0, imageIndex),
					{
						...images[imageIndex],
						top,
						left
					},
					...images.slice(imageIndex + 1)
				]);
			}
		} else if (type === 'NFT') {
			const nftIndex = NFTs.findIndex((nft) => nft.key === id);
			if (nftIndex !== -1) {
				setNFTs([
					...NFTs.slice(0, nftIndex),
					{
						...NFTs[nftIndex],
						top,
						left
					},
					...NFTs.slice(nftIndex + 1)
				]);
			}
		}

		if (type === 'chat') {
			setWaterfallChat((waterfallChat) => ({ ...waterfallChat, top: top, left: left}));
		}

		else{
			const { isSuccessful, message } = await firebaseContext.movePinnedRoomItem(
				roomId || 'default',
				{
					type,
					top: y,
					left: x,
					key: id
				}
			);

			//reverse the changes in client in case has no permission to edit
			if (!isSuccessful) {
				if (message) {
					setModalErrorMessage(message);
				}
				left -= deltaX;
				top -= deltaY;

				if (type === 'text') {
					setPinnedText(
						update(pinnedText, {
							[id]: {
								$merge: { left, top }
							}
						})
					);
				} else if (type === 'gif') {
					const gifIndex = gifs.findIndex((gif) => gif.key === id);
					if (gifIndex !== -1) {
						setGifs([
							...gifs.slice(0, gifIndex),
							{
								...gifs[gifIndex],
								top,
								left
							},
							...gifs.slice(gifIndex + 1)
						]);
					}
				} else if (type === 'image') {
					const imageIndex = images.findIndex((image) => image.key === id);
					if (imageIndex !== -1) {
						setImages([
							...images.slice(0, imageIndex),
							{
								...images[imageIndex],
								top,
								left
							},
							...images.slice(imageIndex + 1)
						]);
					}
				} else if (type === 'NFT') {
					const nftIndex = NFTs.findIndex((nft) => nft.key === id);
					if (nftIndex !== -1) {
						setNFTs([
							...NFTs.slice(0, nftIndex),
							{
								...NFTs[nftIndex],
								top,
								left
							},
							...NFTs.slice(nftIndex + 1)
						]);
					}
				}
				return;
			}
		}
		socket.emit('event', {
			key: 'move-item',
			type,
			top: y,
			left: x,
			itemKey: id
		});
	};

	const onClickPresent = async () => {
		if (!isLoggedIn) {
			await signIn();
		}

		firebaseContext
			.acquireTokens('trychats')
			.then(({ isSuccessful, message }) => {
				if (!isSuccessful) {
					setModalErrorMessage(message || 'Error acquiring tokens');
				} else {
					setModalSuccessMessage(
						'Successfully acquired 10000 $TRYCHATS tokens'
					);
				}
			});
	};

	if (isInvalidRoom) {
		return <div>Invalid room {roomId} : {invalidRoomMessage} <MetamaskSection /> </div>;

	}

	const steps = [
		{
			selector: ".first-step",
			content: "Click on the settings tab to customize your avatar and name"
		},{
			selector: ".second-step",
			content: "Enter a screen name and press update"
		},{
			selector: ".third-step",
			content: "Select an avatar and click go"
		},{
			selector: ".fourth-step",
			content: "Create and enter rooms here"
		},{
			selector: ".fifth-step",
			content: "You can use interactive backgrounds like youtube, maps and opensea by pinning them in the top right corner"
		}, {
			selector: ".sixth-step",
			content: "Invite the homies and earn tokens"
		}]


	return (
		<div
			className="app"
			style={{
				height: window.innerHeight - bottomPanelHeight
			}}
			onClick={onClickApp}
		>
			<MetamaskSection />

			<Route path="/settings">
				<SettingsPanel 
					onSubmitUrl={(url) => actionHandler('settings', 'url', url)}
					onChangeName={(name) => actionHandler('settings', 'name', name)}
					onChangeAvatar={(avatar) => actionHandler('settings', 'avatar', avatar)}
					onSendLocation={(location) => actionHandler('weather', location)}
					currentAvatar={userProfile.avatar}
					setStep={setStep}
				/>
			</Route>

			<Route exact path={["/room/:roomId", "/"]}>
			<Board
				videoId={videoId}
				volume={volume}
				background={background}
				musicNotes={musicNotes}
				updateNotes={setMusicNotes}
				emojis={emojis}
				updateEmojis={setEmojis}
				gifs={gifs}
				updateGifs={setGifs}
				images={images}
				updateImages={setImages}
				chatMessages={chatMessages}
				updateChatMessages={setChatMessages}
				userLocations={userLocations}
				userProfiles={userProfiles}
				setUserProfiles={setUserProfiles}
				animations={animations}
				updateAnimations={setAnimations}
				avatarMessages={avatarMessages}
				weather={weather}
				updateWeather={setWeather}
				pinGif={pinGif}
				unpinGif={unpinGif}
				pinImage={pinImage}
				unpinImage={unpinImage}
				pinBackground={pinBackground}
				unpinBackground={unpinBackground}
				pinnedText={pinnedText}
				unpinText={unpinText}
				moveItem={moveItem}
				NFTs={NFTs}
				updateNFTs={setNFTs}
				pinNFT={pinNFT}
				unpinNFT={unpinNFT}
				addNewContract={addNewContract}
				loadingNFT={loadingNFT}
				onBuy={() => {}}
				onCancel={() => {}}
				onClickNewRoom={() => setModalState('new-room')}
				onClickPresent={onClickPresent}
				waterfallChat={waterfallChat}
				/>
			</Route>

			<Tour 
				steps={steps}
				isOpen={showTour}
				onRequestClose={() => setShowTour(false)}
				disableDotsNavigation={true}
				disableFocusLock={true}
				goToStep={step}
				lastStepNextButton={<CloseIcon />}
				showCloseButton={false}
			/>
			
			{showLoginModal ? (
				<Login 
					beginTour={setShowTour} 
					showModal={setShowLoginModal}
					isFirstVisit={isFirstVisit}
					userEmail={userProfile.email}
					setUserEmail={(email) => actionHandler('settings', 'email', email)}
				/>
			 ) : null }

			<TowerDefense
				state={towerDefenseState}
				updateUnits={(units) =>
					setTowerDefenseState((state) => ({ ...state, units }))
				}
				updateProjectiles={(projectiles) =>
					setTowerDefenseState((state) => ({ ...state, projectiles }))
				}
				updateGold={(gold) =>
					setTowerDefenseState((state) => ({ ...state, gold }))
				}
			/>

			<Whiteboard
				onWhiteboardPanel={onWhiteboardPanel}
				canvasRef={canvasRef}
				brushColor={brushColor}
				onAction={actionHandler}
			/>

			<div className="open-panel-button">
				{!isPanelOpen && (
					<Tooltip title="open panel">
						<IconButton
							onClick={() => {
								setIsPanelOpen(true);
							}}
						>
							<ChevronRight />
						</IconButton>
					</Tooltip>
				)}
			</div>
			<Panel
				onClick={onClickPanelItem}
				isOpen={isPanelOpen}
				onClose={() => {
					setIsPanelOpen(false);
				}}
				selectedItem={selectedPanelItem}
				avatar={
					userProfile && userProfile.avatar
						? avatarMap[userProfile.avatar]
						: undefined
				}
			/>

			<Tooltip
				title={`version: ${process.env.REACT_APP_VERSION}. production: leo, mike, yinbai, krishang, tony, grant, andrew, sokchetra, allen, ishaan, kelly, taner, eric, anthony, maria`}
				placement="left"
			>
				<a
					href="https://adventurenetworks.net"
					target="_blank"
					rel="noreferrer"
					className="adventure-logo"
				>
					<div>adventure</div>
					<div>networks</div>
				</a>
			</Tooltip>

			<BottomPanel
				bottomPanelRef={bottomPanelRef}
				towerDefenseState={towerDefenseState}
				setBrushColor={(color: string) => setBrushColor(color)}
				type={selectedPanelItem}
				isOpen={Boolean(selectedPanelItem)}
				onAction={actionHandler}
				updateIsTyping={onIsTyping}
				onNFTError={setModalErrorMessage}
				onNFTSuccess={onNFTSuccess}
				setVideoId={setVideoId}
				setVolume={setVolume}
				roomData={roomData}
				updateShowChat = {onShowChat}
			/>


			{userProfile && !onBrowseNFTPanel && (
				<UserCursor
					ref={userCursorRef}
					{...userProfile}
					deleteSoundType={deleteProfileSoundType}
					isSelectingTower={towerDefenseState.selectedPlacementTower}
					isMovingBoardObject={!!movingBoardItem}
				/>
			)}
			<Modal
				onClose={() => setModalState(null)}
				className="modal-container"
				open={!!modalState}
			>
				<>
					{modalState === 'new-room' && (
						<NewChatroom
							onClickCancel={() => setModalState(null)}
							onCreate={onCreateRoom}
						/>
					)}
					{modalState === 'enter-room' && (
						<EnterRoomModal
							roomName={roomToEnter}
							onClickCancel={() => setModalState(null)}
						/>
					)}
					{modalState === 'error' && modalErrorMessage && (
						<ErrorModal
							onClickCancel={() => {
								setModalState(null);
								setModalErrorMessage(null);
							}}
							message={modalErrorMessage}
						/>
					)}
					{modalState === 'success' && modalSuccessMessage && (
						<SuccessModal
							onClickCancel={() => {
								setModalState(null);
								setModalSuccessMessage(null);
							}}
							message={modalSuccessMessage}
						/>
					)}
				</>
			</Modal>
		</div>
	);
}

const generateRandomXY = (centered?: boolean, gif?: boolean) => {
	if (centered) {
		const randomX =
			(Math.random() * window.innerWidth * 2) / 4 + window.innerWidth / 4;
		const randomY =
			(Math.random() * window.innerHeight * 2) / 4 + window.innerHeight / 4;
		// if its a gif, make sure it appears above the tall gif panel, but make sure its not too high as well.
		if (gif)
			return {
				x: randomX,
				y: Math.max(window.innerHeight / 4, randomY - GIF_PANEL_HEIGHT)
			};
		return { x: randomX, y: randomY };
	} else {
		const randomX = Math.random() * window.innerWidth;
		const randomY = Math.random() * window.innerHeight;
		return { x: randomX, y: randomY };
	}
};

export const getRelativePos = (
	clientX: number,
	clientY: number,
	width: number,
	height: number
) => {
	const x = clientX;
	const y = clientY;

	const relativeX = (x - width) / window.innerWidth;
	const relativeY = (y - height) / window.innerHeight;

	return { x: relativeX, y: relativeY };
};

const getDistanceBetweenPoints = (
	x1: number,
	y1: number,
	x2: number,
	y2: number
) => {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};

const imageToUrl = (name: string) => {
	return name.startsWith('http') ? name : backgrounds[name] || '';
};

const RouterHandler = () => {
	return (
		<Router>
			<Switch>
				<Route path="/room/:roomId">
					<App />
				</Route>
				<Route path="/">
					<App />
				</Route>
			</Switch>
		</Router>
	);
};

export default RouterHandler;
