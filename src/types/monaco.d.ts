/** 扩展 Window 支持 MonacoEnvironment */
interface Window {
	MonacoEnvironment?: {
		getWorker(workerId: string, label: string): Worker;
	};
}
