import {
	Button,
	FormControl,
	FormLabel,
	Heading,
	Input,
	Textarea,
	VStack,
	FormErrorMessage,
} from "@chakra-ui/react";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";
import detectEthereumProvider from "@metamask/detect-provider";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { providers, utils, Contract } from "ethers";
import Head from "next/head";
import React, { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

export default function Home() {
	const [logs, setLogs] = React.useState("Connect your wallet and greet!");
	const [name, setName] = React.useState("");

	const GreetingSchema = Yup.object({
		name: Yup.string().required("Name is required"),
		age: Yup.number().required("Age is required").positive().integer(),
		address: Yup.string().required("Address is required"),
	});

	useEffect(() => {
		const provider = new providers.WebSocketProvider("ws://127.0.0.1:8545");
		const contract = new Contract(
			"0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
			Greeter.abi,
			provider
		);
		contract.on("NewGreeting", (greeting) => {
			setLogs(`Greeting is ${utils.parseBytes32String(greeting)}`);
		});
	}, []);

	const formik = useFormik({
		initialValues: {
			name: "",
			age: "",
			address: "",
			greet: "",
		},
		onSubmit: (values) => {
			console.log(values);
			greet(values.greet);
		},
		validationSchema: GreetingSchema,
	});

	async function greet(greet) {
		setLogs("Creating your Semaphore identity...");

		const provider = (await detectEthereumProvider()) as any;

		await provider.request({ method: "eth_requestAccounts" });

		const ethersProvider = new providers.Web3Provider(provider);
		const signer = ethersProvider.getSigner();
		const message = await signer.signMessage(
			"Sign this message to create your identity!"
		);

		const identity = new ZkIdentity(Strategy.MESSAGE, message);
		const identityCommitment = identity.genIdentityCommitment();
		const identityCommitments = await (
			await fetch("./identityCommitments.json")
		).json();

		const merkleProof = generateMerkleProof(
			20,
			BigInt(0),
			identityCommitments,
			identityCommitment
		);

		setLogs("Creating your Semaphore proof...");
		const greeting = greet;

		const witness = Semaphore.genWitness(
			identity.getTrapdoor(),
			identity.getNullifier(),
			merkleProof,
			merkleProof.root,
			greeting
		);

		const { proof, publicSignals } = await Semaphore.genProof(
			witness,
			"./semaphore.wasm",
			"./semaphore_final.zkey"
		);

		const solidityProof = Semaphore.packToSolidityProof(proof);

		const response = await fetch("/api/greet", {
			method: "POST",
			body: JSON.stringify({
				greeting,
				nullifierHash: publicSignals.nullifierHash,
				solidityProof: solidityProof,
			}),
		});

		if (response.status === 500) {
			const errorMessage = await response.text();
			setLogs(errorMessage);
		}
	}

	return (
		<div style={{ background: "var(--chakra-colors-purple-500)" }}>
			<Head>
				<title>Greetings</title>
				<meta
					name='description'
					content='A simple Next.js/Hardhat privacy application with Semaphore.'
				/>
				<link rel='icon' href='/favicon.ico' />
			</Head>
			<VStack
				alignItems='center'
				justifyContent='center'
				minHeight='100vh'>
				<Heading style={{ color: "var(--chakra-colors-white)" }}>
					Greetings
				</Heading>
				<p
					style={{
						color: "var(--chakra-colors-white)",
						fontSize: "1.4rem",
					}}>
					A simple Next.js/Hardhat privacy application with Semaphore.
				</p>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						formik.handleSubmit();
					}}
					style={{ padding: "1rem", width: "450px" }}>
					<VStack width='100%' color='white' alignItems='center'>
						<FormControl
							isInvalid={formik.errors.name !== undefined}>
							<FormLabel htmlFor='name'>Name</FormLabel>
							<Input
								id='name'
								onChange={formik.handleChange}
								placeholder='Enter your name'
							/>
							<FormErrorMessage>
								{formik.errors.name}
							</FormErrorMessage>
						</FormControl>
						<FormControl
							isInvalid={formik.errors.age !== undefined}>
							<FormLabel htmlFor='age'>Age</FormLabel>
							<Input
								id='age'
								name='age'
								onChange={formik.handleChange}
								value={formik.values.age}
								type='text'
								placeholder='Enter your age'
							/>
							<FormErrorMessage>
								{formik.errors.age}
							</FormErrorMessage>
						</FormControl>
						<FormControl
							isInvalid={formik.errors.address !== undefined}>
							<FormLabel>Address</FormLabel>
							<Textarea
								onChange={formik.handleChange}
								value={formik.values.address}
								name='address'
								placeholder='Enter your address'
							/>
							<FormErrorMessage>
								{formik.errors.address}
							</FormErrorMessage>
						</FormControl>
						<FormControl
							isInvalid={formik.errors.greet !== undefined}>
							<FormLabel>Greeting</FormLabel>
							<Input
								id='greet'
								onChange={formik.handleChange}
								placeholder='Enter your Greeting'
							/>
							<FormErrorMessage>
								{formik.errors.greet}
							</FormErrorMessage>
						</FormControl>
						<Button type='submit' textColor='purple.500'>
							Greet
						</Button>
					</VStack>
				</form>
				<div
					style={{
						color: "var(--chakra-colors-green-200)",
						fontSize: "1.2rem",
						fontFamily: "monospace",
						background: "black",
						padding: "1rem",
						borderRadius: ".5rem",
					}}>
					{logs}
				</div>
			</VStack>
		</div>
	);
}
